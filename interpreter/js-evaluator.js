
// var esprima = require('esprima');
//var program = esprima.parse(input);

/* Not Implemented
-Arrays
-Conditionals
-Control Flow, add PC and such
*/

const G = {
  symbolTable: {},
  posList: [],
  highlightTable: {},
  tokensRanges: [],
  tokens: []
};

/*function eval(body) {
  var result = undefined; //clumsy way of doing this but will do for now
  for (expression of body) {
    var newResult = evalParsedJS(expression);
    if (newResult !== undefined) {
      result = newResult;
    }
  }
  return result;
}*/

function eval(body, highlight=false) {
  var result = undefined; //clumsy way of doing this but will do for now
  for (expression of body) {
    var newResult = evalParsedJS(expression, highlight);
    if (newResult !== undefined) {
      result = newResult;
    }
  }
  return result;
}

//do it line by line, a while type of deal?
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
        highlightJS(input.expression.loc); //?
      }
      return evalParsedJS(input.expression, highlight);

    case esprima.Syntax.VariableDeclaration:
      if (highlight) {
        highlightJS(input.declarations[0].id.loc);
        //highlightJS(input.declarations[0].init.loc);
      }
      const val = evalParsedJS(input.declarations[0].init, highlight);
      put(input.declarations[0].id.name, val);
      break;

    case esprima.Syntax.BinaryExpression:
      if (highlight) {
        highlightJS(input.loc);
        const opLoc = G.tokens.filter(x => x.value === input.operator);
        highlightJS(opLoc[0].loc);
        //highlightJS(input.left.loc);
        //highlightJS(input.right.loc);
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
        input.params.map(x => highlightJS(x.loc)); //?
        highlightJS(input.body.loc); //? one less .body perhaps
      }
      const name = input.id.name;
      const params = input.params.map(x => x.name);
      const body = input.body.body; //the body is a block statement, get body of that
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
        return eval(body, highlight);
      } else {
        return -1;
        //function hasn't been defined
      }


    case esprima.Syntax.ReturnStatement:
      if (highlight) {
        highlightJS(input.loc);
        highlightJS(input.argument.loc);
      }
      const arg = evalParsedJS(input.argument, highlight);
      return arg;

  }
}


function highlightJS(position) {
  const startLine = position.start.line-1;
  const startCol = position.start.column;
  const endLine = position.end.line-1;
  const endCol = position.end.column;
  const range = {start: {row: startLine,
                       column: startCol},
               end: {row: endLine,
                     column:endCol}
              };
  G.tokensRanges.push(range);
//   G.editor.selection.setRange(range);
}


/*
//do it line by line, a while type of deal?
function evalParsedJS(input) {
  var type = input.type;
  switch(type) {
    case esprima.Syntax.Literal:
      return input.value;

    case esprima.Syntax.Identifier:
      if (lookup(input.name)) {
        return getValue(input.name);
      } else {
        return -1; //change
        //variable undefined
      }

    case esprima.Syntax.ExpressionStatement:
      return evalParsedJS(input.expression);

    case esprima.Syntax.VariableDeclaration:
      const val = evalParsedJS(input.declarations[0].init);
      put(input.declarations[0].id.name, val);
      break;

    case esprima.Syntax.BinaryExpression:
      const left = evalParsedJS(input.left);
      const right = evalParsedJS(input.right);
      return binExpEval(left, right, input.operator);

    case esprima.Syntax.AssignmentExpression:
      //this makes some assumptions
      if (lookup(input.left.name)) {
        const right = evalParsedJS(input.right);
        put(input.left.name, right);
        break;
      } else {
        //this means the variable hasn't been defined
        return -1; //change
      }
    case esprima.Syntax.FunctionDeclaration:
      const name = input.id.name;
      const params = input.params.map(x => x.name);
      const body = input.body.body; //the body is a block statement, get body of that
      G.symbolTable[name] = {params : params, body : body};
      break;

    case esprima.Syntax.CallExpression:
      const callee = input.callee.name;
      const argVals = input.arguments.map(x => evalParsedJS(x));
      //bind arguments and values
      if (lookup(callee)) {
        const body = getValue(callee).body;
        const params = getValue(callee).params;
        bindVals(params, argVals);
        return eval(body);
      } else {
        return -1;
        //function hasn't been defined
      }


    case esprima.Syntax.ReturnStatement:
      const arg = evalParsedJS(input.argument);
      return arg;

  }
}*/

function binExpEval(left, right, op) {
  switch (op) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '/':
      return left / right;
    case '*':
      return left * right;
  }
}

function bindVals(params, argVals) {
  for (p of params) for (a of argVals) G.symbolTable[p] = a;
}

function put(name, value) {
  G.symbolTable[name] = value;
}

function lookup(name) {
  return G.symbolTable[name];
}

function getValue(name) {
  return G.symbolTable[name];
}




// module.exports = {eval, evalParsedJS, esprima, G};
