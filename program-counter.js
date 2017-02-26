const G = {
  symbolTable: {},
  posList: [],
  highlightTable: {},
  tokensRanges: [],
  tokens: [],
  positionStack: [],
  nodes: {},
  PC: 0
}

function eval(body, highlight=false) {
  var keepGoing = true;
  var result = undefined;
  G.PC = 0;
  while (keepGoing) {
    var expression = body[G.PC];
    var newResult = evalParsedJS(expression, highlight);
    if (newResult !== undefined) {
      result = newResult;
    }
    G.PC++;

    if (body[G.PC]) {
      //keep going
    } else {
      //this body is finished but there could be one on the stack
      var pos = positionStack.pop();
      if (pos) {
        const uuid = Object.keys(pos)[0];
        G.PC = pos[uuid];
        body = nodes[uuid];
      } else {
        keepGoing = false;
      }
    }
  }
  return result;
}


/*
function eval(body, highlight=false) {
  var result = undefined; //clumsy way of doing this but will do for now
  for (expression of body) {
    var newResult = evalParsedJS(expression, highlight);
    if (newResult !== undefined) {
      result = newResult;
    }
  }
  return result;
}*/

function evalParsedJS(input, highlight=false) {
  var type = input.type;
  switch(type) {
    case esprima.Syntax.Literal:
      if (highlight) {
        highlightJS(input.loc);
      }
      return input.value;

    case esprima.Syntax.Identifier:
      if (lookup(input.name)) {
        if (highlight) {
          highlightJS(input.loc);
        }
        return getValue(input.name);
      } else {
        return -1; //change
        //variable undefined
      }

    case esprima.Syntax.ExpressionStatement:
      if (highlight) {
        highlightJS(input.expression.loc);
      }
      return evalParsedJS(input.expression, highlight);

    case esprima.Syntax.VariableDeclaration:
      if (highlight) {
        highlightJS(input.declarations[0].id.loc);
      }
      const val = evalParsedJS(input.declarations[0].init, highlight);
      put(input.declarations[0].id.name, val);
      break;

    case esprima.Syntax.BinaryExpression:
      if (highlight) {
        highlightJS(input.loc);
        const opLoc = G.tokens.filter(x => x.value === input.operator);
        highlightJS(opLoc[0].loc);
      }
      const left = evalParsedJS(input.left, highlight);
      const right = evalParsedJS(input.right, highlight);
      return binExpEval(left, right, input.operator);

    case esprima.Syntax.AssignmentExpression:
      //this makes some assumptions
      if (lookup(input.left.name)) {
        if (highlight) {
          highlightJS(input.left.loc);
        }
        const right = evalParsedJS(input.right, highlight);
        put(input.left.name, right);
        break;
      } else {
        //this means the variable hasn't been defined
        return -1; //change
      }
    case esprima.Syntax.FunctionDeclaration:
      if (highlight) {
        highlightJS(input.id.loc);
        input.params.map(x => highlightJS(x.loc));
        highlightJS(input.body.loc);
      }
      if (!input.uuid) {
        addNode(input);
      }
      const name = input.id.name;
      const params = input.params.map(x => x.name);
      const body = input.body.body; //the body is a BlockStatement, get body of that
      G.symbolTable[name] = {params : params, body : body};
      break;

    case esprima.Syntax.CallExpression:
      if (highlight) {
        highlightJS(input.callee.loc);
      }
      const callee = input.callee.name;
      const argVals = input.arguments.map(x => evalParsedJS(x, highlight));
      //bind arguments and values
      if (lookup(callee)) {
        const body = getValue(callee).body;
        const params = getValue(callee).params;
        bindVals(params, argVals);
        var pos = {};
        pos[input.uuid] = G.PC + 1; //what if this goes off the end?
        positionStack.push(pos);
        return eval(body, highlight);
      } else {
        return -1;
        //function hasn't been defined
      }

    case esprima.Syntax.IfStatement:
      const test = input.test;
      const then = input.consequent; //BlockStatement
      const alternate = input.alternate; //BlockStatement
      if (evalParsedJS(test)) {
        if (!input.consequent.uuid) {
            addNode(input.consequent);
        }
        return eval(then.body, highlight);
      } else {
        if (!input.alternate.uuid) {
          addNode(input.alternate);
        }
        return eval(alternate.body, highlight);
      }

    case esprima.syntax.WhileStatement:
      const test = input.test;
      const inBody = input.body;
      if (!input.body.uuid) {
        addNode(input);
      }
      while (evalParsedJS(test)) {
        var result = evalParsedJS(inBody.body.body);
      }
      return result;

    case esprima.Syntax.BlockStatement:
      return evalParsedJS(input.body);

    case esprima.Syntax.ReturnStatement:
      if (highlight) {
        highlightJS(input.loc);
        highlightJS(input.argument.loc);
      }
      const arg = evalParsedJS(input.argument, highlight);
      return arg;
  }
}
