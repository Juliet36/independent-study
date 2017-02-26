/* Static Analysis

-Go through body and if it's a function statement, map it to its body
-Generate UIDs for every node we come upon, every line of body statement
-Tokenize the program
*/

function mapFunctions(body) {
  for (expression of body) {
    if (expression.type === esprima.Syntax.FunctionDeclaration) {
      const name = expression.id.name;
      const params = expression.params.map(x => x.name);
      const body = expression.body.body;
      G.symbolTable[name] = {params: params, body: body};
      addNode(expression);

      //map to body like in evaluator
        //add check to evaluator so as to be not redundant
      //generate uuid, add to nodes stack as key to node value

    }
  }
}






//This will take FunctionDeclaration, WhileStatement, IfStatement, ?
function addNode(node) {
  const uuid = guid();
  node.id = uuid;
  nodes[uuid] = node;
  //var idObj = {};
  //idObj[uuid] = node;
  //nodes.push(idObj);
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
