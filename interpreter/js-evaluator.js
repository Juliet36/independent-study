/* Not Implemented
-Arrays
*/

const G = {
  symbolTable: {},
  posList: [],
  highlightTable: {},
  tokensRanges: [],
  tokens: [],
  positionStack: [],
  nodes: {},
  PC: 0,
  currentUUID: null,
  justCalled: false,
  varDecJustCalled: false,
  PCs: []
};

function reset() {
  G.symbolTable = {};
  G.posList = [];
  G.highlightTable = {};
  G.tokensRanges = [];
  G.tokens = [];
  G.positionStack = [];
  G.nodes = {};
  G.PC = 0;
  G.currentUUID = null;
  G.justCalled = false;
  G.varDecJustCalled = false;
  G.PCs= [];
}

function start(body, highlight=false) {
  addNode(body);
  G.currentUUID = body.uid;
  for (expression of body) {
    if (expression.type === esprima.Syntax.FunctionDeclaration) {
      const name = expression.id.name;
      const params = expression.params.map(x => x.name);
      const body = expression.body.body;
      addNode(body);
      var entry = {};
      entry['params'] = params;
      entry['body'] = body;
      entry['id'] = expression.uid;
      G.symbolTable[name] = entry;
    }
  }
  return eval(body, highlight);
}

function eval(body, highlight=false) {
  var keepGoing = true;
  var result = undefined;
  G.PC = 0;
  while (keepGoing) {
    G.counter ++;
    var expression = body[G.PC];
    var newResult = evalParsedJS(expression, highlight);
    if (newResult !== undefined) {
      result = newResult;
    }
    G.PC++;
    if (body[G.PC] && expression.type !== esprima.Syntax.ReturnStatement) {
      //keep going
    }
    else {
      if ((G.justCalled || G.varDecJustCalled)&& expression.type === esprima.Syntax.ReturnStatement) {
        G.justCalled = false;
        if (G.varDecJustCalled) {
          G.PC = G.PCs.pop();
        }
        G.varDecJustCalled = false;
        break;
      }
      //this body is finished but there could be one on the stack
      var pos = G.positionStack.pop();
      if (pos) {
        const uuid = Object.keys(pos)[0];
        G.currentUUID = uuid;
        G.PC = pos[uuid];
        body = G.nodes[uuid];
        if (expression.type === esprima.Syntax.ReturnStatement || !body[G.PC]) {
          keepGoing=false;
        }
      } else {
        keepGoing = false;
      }
    }
  }
  return result;
}

function evalParsedJS(input, highlight=false) {
  var type = input.type;
  switch(type) {
    case esprima.Syntax.Literal:
      if (highlight) {
        highlightJS(input.loc);
      }
      return input.value;

    case esprima.Syntax.Identifier:
      if (lookup(input.name) || lookup(input.name) === 0) {
        if (highlight) {
          highlightJS(input.loc);
        }
        return getValue(input.name);
      } else {
        return -2; //change
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
      if (input.declarations[0].init.type === esprima.Syntax.CallExpression) {
        G.varDecJustCalled = true;
        G.PCs.push(G.PC);
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
      if (lookup(input.left.name) || lookup(input.left.name) === 0) {
        if (highlight) {
          highlightJS(input.left.loc);
        }
        if (input.right.type === esprima.Syntax.CallExpression) {
          G.justCalled = true;
        }
        const right = evalParsedJS(input.right, highlight);
        put(input.left.name, right);
        break;
      } else {
        //this means the variable hasn't been defined
        return -3; //change
      }
    case esprima.Syntax.FunctionDeclaration:
      if (highlight) {
        highlightJS(input.id.loc);
        input.params.map(x => highlightJS(x.loc));
        highlightJS(input.body.loc);
      }
      if (!input.body.uid) {
        addNode(input.body);
      }
      const name = input.id.name;
      if (!G.symbolTable[name]) { //for some reason
        const name = input.id.name;
        const params = input.params.map(x => x.name);
        const body = input.body.body; //the body is a BlockStatement, get body of that
        addNode(input);
        var entry = {};
        entry['params'] = params;
        entry['body'] = body;
        entry['id'] = expression.uid;
        G.symbolTable[name] = entry;
      }
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
        const id = getValue(callee).id;
        bindVals(params, argVals);
        pushPosition(body.uid);
        return eval(body, highlight);
      } else {
        return -1;
        //function hasn't been defined
      }

    case esprima.Syntax.IfStatement:
      const test = input.test;
      const then = input.consequent; //BlockStatement
      const alternate = input.alternate; //BlockStatement
      if (evalParsedJS(test, highlight)) {
        if (!input.consequent.uid) {
            addNode(input.consequent);
        }
        pushPosition(input.consequent.uid);
        return eval(then.body, highlight);
      } else if (input.alternate !== null) {
          if (!input.alternate.uid) {
            addNode(input.alternate);
          }
          pushPosition(input.alternate.uid);
          return eval(alternate.body, highlight);
        }
      break;

    case esprima.Syntax.WhileStatement:
      const condition = input.test;
      const inBody = input.body;
      if (!inBody.body.uid) {
        addNode(inBody.body);//Because it's a BlockStatement (right?)
      }
      if (evalParsedJS(condition, highlight)) {
        pushPosition(inBody.body.uid, whileStatement=true);
        var result = eval(inBody.body, highlight);
      }
      return result;

    case esprima.Syntax.BlockStatement:
      return evalParsedJS(input.body, highlight);

    case esprima.Syntax.ReturnStatement:
      if (highlight) {
        highlightJS(input.loc);
        highlightJS(input.argument.loc);
      }
      //In case it is just return and doesn't have an arg
      if (input.argument) {
        const arg = evalParsedJS(input.argument, highlight);
        return arg;
      } else {
        return;
      }
  }
}

//This will take FunctionDeclaration, WhileStatement, IfStatement, ?
function addNode(node) {
  const uuid = guid();
  node.uid = uuid;
  G.nodes[uuid] = node;
}

function pushPosition(uuid, whileStatement=false) {
  var pos = {};
  var PC = G.PC;
  if (!whileStatement) {
    PC += 1;
  }
  pos[G.currentUUID] = PC;
  G.positionStack.push(pos);
  G.currentUUID = uuid;
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
}

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
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '===':
      return left === right;
    case '!==':
      return left !== right;
    case '%':
      return left % right;
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


//http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);
}
