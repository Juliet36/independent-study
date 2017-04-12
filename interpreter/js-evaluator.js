/* Not Implemented
-Scopes
*/
const esprima = require('../node_modules/esprima');

const G = {
  symbolTable: {},
  conditionVariables: {},
  tokensRanges: [],
  tokens: [],
  positionStack: [],
  nodes: {},
  PC: 0,
  currentUUID: undefined,
  body:undefined,
  result:undefined,
  justBroken: false,
  popped: 0,
  valid: true,
  wait: false,
  whileCondition: false
};

function reset() {
  G.symbolTable = {};
  G.conditionVariables = {};
  G.tokensRanges = [];
  G.tokens = []; //define this?
  G.positionStack = [];
  G.nodes = {};
  G.PC = 0;
  G.currentUUID = undefined;
  G.body=undefined;
  G.result=undefined;
  G.justBroken = false;
  G.popped = 0;
  G.valid = true;
  G.wait = false;
  G.whileCondition = false;
}


function run(code) {
  const tokens = esprima.tokenize(code, {loc: true});
  const parsedCode = esprima.parse(code);
  reset();
  const result = start(parsedCode.body);
  console.log("Result " + JSON.stringify(result));
  console.log("World " + JSON.stringify(G.symbolTable));
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
  G.body = body;
  G.keepGoing = true;
  var res = eval(highlight);
  if (G.positionStack.length > 0) {
    console.log('BAD: stuff still on the stack');
    console.log(JSON.stringify(G.positionStack));
  }
  return res;
}

function eval(highlight=false) {
  while (G.keepGoing) {
  //  console.log("\nPC: " + G.PC + " UUID: " + G.currentUUID);
    if (G.body["invalid"]) { //the bodies will have an invalid added in the invalidUntilCall
    //  console.log('\nbreak because invalid body: ' + G.currentUUID);
      popRestore();
    //  console.log('\nafter restoring and before break, new UUID: ' + G.currentUUID);
      G.justBroken = true;
      break;
    } else if (G.PC >= G.body.length) {
    //  console.log('\nbreak because program counter off end of body: ' + G.currentUUID);
      if (G.positionStack.length === 0) {
    //    console.log('\nand nothing to popRestore');
        G.justBroken = true;
        break;
      }
      popRestore();
    //  console.log('\nafter restoring, before break, UUID: ' + G.currentUUID);
      G.justBroken = true;
      break;
    } else if (G.body[G.PC]) {
    //  console.log('\nvalid expression: ' + G.currentUUID);
      var expression = G.body[G.PC];
      var newResult = evalParsedJS(expression, highlight);
      if (newResult !== undefined) {
        G.result = newResult;
      }
      if (expression.type === esprima.Syntax.ReturnStatement) {
  //      console.log('\nb4 invalid: ' + JSON.stringify(G.positionStack));
        invalidUntilCall(G.positionStack.length-1);
  //      console.log('\nafter invalid: ' + JSON.stringify(G.positionStack));
        popRestore();
        G.justBroken = true;
        break;//?
      }
    //  console.log('\nbody is valid: ' + G.currentUUID + " " + G.justBroken + " " + G.body['invalid']);
      if (G.justBroken) {
    //    console.log('\ndo not increment counter');
        G.justBroken = false;
      } else {
    //    console.log('\nincrement counter: ' + G.currentUUID);
        G.PC++;
      }
    }
  }
  return G.result;
}



function evalParsedJS(input, highlight=false) {
  var type = input.type;
  switch(type) {
    case esprima.Syntax.Literal:
      if (highlight) {
        highlightJS(input.loc);
      }
      return input.value;

    case esprima.Syntax.UnaryExpression:
      if (highlight) { //highlight the unary symbol
        highlightJS(input.loc); //???
      }
      if (input.operator === '-') {
        var arg = evalParsedJS(input.argument, highlight);
        return -arg;
      } else if (input.operator === '!') {
        var arg = evalParsedJS(input.argument, highlight);
        return !arg;
      } else {
        return -6;
      }

    case esprima.Syntax.UpdateExpression:
      if (highlight) { //highlight the update symbol
        highlightJS(input.loc); //???
      }
      if (input.operator === '++') {
        var arg = evalParsedJS(input.argument, highlight);
        put(input.argument.name, arg+1);
      }

    case esprima.Syntax.Identifier:
      if (lookup(input.name) || lookup(input.name) === 0 || lookup(input.name) === false || lookup(input.name) === "" || lookup(input.name) === null) {
        if (highlight) {
          highlightJS(input.loc);
        }
        if (G.whileCondition) {
          G.conditionVariables[input.name] = getValue(input.name);
        }
        return getValue(input.name);
      } else {
        console.log('could not find: ' +  input.name + "\n");
        return -2;
        //variable undefined
      }

    case esprima.Syntax.ArrayExpression:
      const elements = input.elements;
      const arr = elements.map(x => evalParsedJS(x, highlight));
      return arr;

    case esprima.Syntax.ExpressionStatement:
      if (highlight) {
        highlightJS(input.expression.loc);
      }
      return evalParsedJS(input.expression, highlight);

    case esprima.Syntax.MemberExpression:
      if (input.computed) {
        //ComputedMemberExpression
        //array access like a[i]
        const obj = evalParsedJS(input.object, highlight);
        const property = evalParsedJS(input.property, highlight);
        return {'object':obj, 'parsedProp':property};
      } else {
        //StaticMemberExpression
        //array operations like push, pop, slice, length
        const obj = evalParsedJS(input.object, highlight);
        const property = input.property.name;//
        return {'object':obj, 'prop':property};
      }

    case esprima.Syntax.VariableDeclaration:
      if (highlight) {
        highlightJS(input.declarations[0].id.loc);
      }
      const val = evalParsedJS(input.declarations[0].init, highlight);
      if (input.declarations[0].init.type === esprima.Syntax.MemberExpression) {
        var memberResult = memberExpHandler(input.declarations[0].init, val);
        put(input.declarations[0].id.name, memberResult);
      } else {
        put(input.declarations[0].id.name, val);
      }
      break;

    case esprima.Syntax.LogicalExpression:
      if (highlight) {
        highlightJS(input.loc);
        const opLoc = G.tokens.filter(x => x.value === input.operator);
        highlightJS(opLoc[0].loc);
      }
      var left = evalParsedJS(input.left, highlight);
      var right = evalParsedJS(input.right, highlight);
      if (input.left.type === esprima.Syntax.MemberExpression) {
        left = memberExpHandler(input.left, left);
      }
      if (input.right.type === esprima.Syntax.MemberExpression) {
        right = memberExpHandler(input.right, right);
      }
      if (left === -4 || right === -4) {
        return -4;
      }
      return logExpEval(left, right, input.operator);

    case esprima.Syntax.BinaryExpression:
      if (highlight) {
        highlightJS(input.loc);
        const opLoc = G.tokens.filter(x => x.value === input.operator);
        highlightJS(opLoc[0].loc);
      }
      var left = evalParsedJS(input.left, highlight);
      var right = evalParsedJS(input.right, highlight);
      if (input.left.type === esprima.Syntax.MemberExpression) {
        left = memberExpHandler(input.left, left);
      }
      if (input.right.type === esprima.Syntax.MemberExpression) {
        right = memberExpHandler(input.right, right);
      }
      if (left === -4 || right === -4) {
        return -4;
      }
      return binExpEval(left, right, input.operator);

    case esprima.Syntax.AssignmentExpression:
      //this makes some assumptions
      if (lookup(input.left.name)
          || lookup(input.left.name) === 0
          || lookup(input.left.name) === false
          || lookup(input.left.name) === ""
          || lookup(input.left.name) === null
          || input.left.type === esprima.Syntax.MemberExpression) {
        if (highlight) {
          highlightJS(input.left.loc);
        }
        const right = evalParsedJS(input.right, highlight);
        var rightResult = right;
        if (input.right.type === esprima.Syntax.MemberExpression ||
        input.left.type === esprima.Syntax.MemberExpression) {
          if (input.right.type === esprima.Syntax.MemberExpression) {
            rightResult = memberExpHandler(input.right, right);
          }
          if (input.left.type === esprima.Syntax.MemberExpression) {
            const left = evalParsedJS(input.left, highlight);
            var pp = left.parsedProp;
            var o = left.object;
            o[pp] = rightResult;
            break;
          }
        }
        put(input.left.name, rightResult);
        break;
      } else {
        //this means the variable hasn't been defined, strict now, don't allow variables without var
        console.log('can not find: ' + input.left.name + ' for assignment');
        return -3;
      }
      break;

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
      if (input.callee.type === esprima.Syntax.Identifier) {
        const callee = input.callee.name;
        const argVals = input.arguments.map(x => evalParsedJS(x, highlight));
        //bind arguments and values
        if (lookup(callee)) {
          const body = getValue(callee).body;
          const params = getValue(callee).params;
          const id = getValue(callee).id;
          bindVals(params, argVals);
          if (body["invalid"]) {
            //console.log('ever?');
            body["invalid"] = false;
          }
          pushPosition(body.uid);
          G.positionStack.push('call');
          //console.log("CALL: " + JSON.stringify(G.positionStack));
          G.body = body;
          G.PC = 0;
          G.keepGoing = true;
          var calret = eval(highlight);
          //console.log('FINISHED CALL: ' + calret);
          return calret;
        //  return eval(highlight);
        } else if (callee === 'alert') {
          alert(argVals);
          break;
        } else if (callee === 'prompt') {
          return prompt(argVals);
        } else if (callee === 'parseFloat') {
          return parseFloat(argVals);
        } else if (callee === 'isNaN') {
          return isNaN(argVals);
        } else {
          console.log('Function: ' + callee + 'has not yet been defined');
          return -1;
          //function hasn't been defined
        }
      } else {
        //its type is MemberExpression
        const objProp = evalParsedJS(input.callee, highlight);
        const obj = objProp.object;
        const prop = objProp.prop;
        if (input.arguments.length > 0) {
          const args = input.arguments.map(x => evalParsedJS(x, highlight));
          if (prop === "push") {
            obj.push(args[0]);
            break;
          } else if (prop === "slice") {
            return obj.slice(args[0], args[1]);
          } else if (prop === 'charAt') {
            return obj.charAt(args[0]); //args in general?
          } else if (prop === 'floor') { //Math is not a variable
            return Math.floor(args[0]); //args in general?
          } else if (prop === 'log') { //console is not a variable
            console.log(args);
            break;
          } else if (prop === 'fromCharCode') { //String is not a variable
            return String.fromCharCode(args);
          } else if (prop === 'charCodeAt') {
            return obj.charCodeAt(args);
          }
        } else {
          //pop(), length, random
          if (prop === 'pop') {
            return obj.pop();
          } else if (prop === 'length') {
            return obj.length;
          } else if (prop === 'random') {
            return Math.random();
          }
        }

      }
      break;

    case esprima.Syntax.IfStatement:
      const test = input.test;
      const then = input.consequent; //BlockStatement
      const alternate = input.alternate; //BlockStatement
      if (evalParsedJS(test, highlight)) {
        if (!input.consequent.body.uid) {
            addNode(input.consequent.body);
        }
        pushPosition(input.consequent.body.uid);
        G.body = then.body;
        G.PC = 0;
        G.keepGoing = true;
        return eval(highlight);
      } else if (input.alternate !== null) {
          if (alternate.type === esprima.Syntax.IfStatement) {
            return evalParsedJS(alternate, highlight);
          } else {
            if (!input.alternate.body.uid) {
              addNode(input.alternate.body);
            }
            pushPosition(input.alternate.body.uid);
            G.body = alternate.body;
            G.PC = 0;
            G.keepGoing = true;
            return eval(highlight);
          }
        }
      break;

    case esprima.Syntax.WhileStatement:
      const condition = input.test;
      const inBody = input.body;
      if (!inBody.body.uid) {
        addNode(inBody.body);//Because it's a BlockStatement (right?)
      }
      G.whileCondition = true;
      var parsedWhile = evalParsedJS(condition, highlight);
      G.whileCondition = false;
      if (parsedWhile) {
        pushPosition(inBody.body.uid, whileStatement=true);
        G.body = inBody.body;
        G.PC = 0
        G.keepGoing = true;
        return eval(highlight);
      }
      break;

    case esprima.Syntax.BlockStatement:
      return evalParsedJS(input.body, highlight);

    case esprima.Syntax.ReturnStatement:
      if (highlight) {
        highlightJS(input.loc);
        highlightJS(input.argument.loc);
      }
      //In case it is just return and doesn't have an arg
      if (input.argument) {
        if (hasCall(input.argument)) {
          G.wait = true;
        }
        G.sameReturn = true;
        const arg = evalParsedJS(input.argument, highlight);
      //  console.log('return arg: ' + arg);
        G.sameReturn = false;
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
  if (!whileStatement && G.lastPop !== G.currentUUID) {
    PC += 1;
  }
  pos[G.currentUUID] = PC;
  pos["keepGoing"] = G.keepGoing;
  G.positionStack.push(pos);
  G.currentUUID = uuid;
//  console.log('pushed: ' + JSON.stringify(pos));
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
  //console.log(left + " " + op + " " + right);
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

function logExpEval(left, right, op) {
//  console.log(left + " " + op + " " + right);
  switch (op) {
    case '&&':
      return left && right;
    case '||':
      return left || right;
  }
}

function memberExpHandler(memExpAST, memExpObj) {
  if (memExpAST.computed) {
    var pp = memExpObj.parsedProp;
    var o = memExpObj.object;
    return o[pp];
  } else {
    if (memExpObj.prop) {
      if (memExpObj.prop === 'length') {
        return memExpObj.object.length;
      } else {
        return -4;
      }
    } else {
      return memExpObj;
    }
  }
}

function bindVals(params, argVals) {
  var i = 0;
  while (i < params.length) {
    G.symbolTable[params[i]] = argVals[i];
    i++;
  }
}

function popRestore() {
  var pos = G.positionStack.pop();
  G.lastPop = Object.keys(pos)[0];
  if (pos !== 'call') {
    var uuid = Object.keys(pos)[0];
    G.currentUUID = uuid;
    G.PC = pos[uuid];
    G.body = G.nodes[uuid];
    G.keepGoing = pos["keepGoing"];
  //  console.log('\nrestored: ' + G.currentUUID + ' PC: ' + G.PC);
    return G.body;
  } else {
    //shouldn't happen
    console.log('else case in popRestore');
  }
}

function invalidUntilCall(i) {
  if (G.positionStack[i] === 'call') {
    G.positionStack.splice(i,1);
    return G.positionStack;
  } else {
    var uuid = Object.keys(G.positionStack[i])[0];
    var body = G.nodes[uuid];
    body["invalid"] = true;
  //  console.log('\nmade body invalid: ' + JSON.stringify(body) + '\n');
    return invalidUntilCall(i-1);
  }
}

function hasCall(arg) {
  if (arg.type === esprima.Syntax.CallExpression) {
   return true;
  } else if (arg.type === esprima.Syntax.BinaryExpression ||
  arg.type === esprima.Syntax.LogicalExpression) {
    var l = hasCall(arg.left);
    var r = hasCall(arg.right);
    return l || r;
  }
  else {
  return false;
  }
}

function put(name, value) {
//  console.log('put: ' + value + ' in: ' + name);
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


module.exports = {run};
