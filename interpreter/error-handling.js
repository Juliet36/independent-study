/*
Catch else ifs without conditions
catch semi colons after conditions
*/
const errorWorld = {
  symbols: [],
  tokens: []
};
function resetSyntax() {
  errorWorld.symbols = [];
  errorWorld.tokens = [];
}

function checkTokens(t) {
  //errorWorld.tokens = t.filter(x => x.type === "Punctuator");
  errorWorld.tokens = t;
  var syntaxError = false;
  var elseCase = false;
  for (token of errorWorld.tokens) {
    if (token.type === "Punctuator") {
      const val = token.value;
      var prevSymbol;
      if (errorWorld.symbols.length > 0) {
        prevSymbol = errorWorld.symbols[errorWorld.symbols.length-1].value;
      } else {
        prevSymbol = -1;
      }
      var syntaxError = false;
      if (val === "(" || val === "{") {
        errorWorld.symbols.push(token);
      } else if (val === ")") {
        if (prevSymbol === "(") {
          errorWorld.lastSymbol = ")";
          errorWorld.symbols.pop();
        } else {
          syntaxError = true;
          break;
        }
      } else if (val === "}") {
        if (prevSymbol === "{") {
          errorWorld.lastSymbol = "}";
          errorWorld.symbols.pop();
        } else {
          syntaxError = true;
          break;
        }
      }
    } else {
      if (token.value === "else") {
        if (errorWorld.lastSymbol !== "}") {
          syntaxError = true;
          elseCase = true;
          var elseToken = token;
          token = {};
          token.else = elseToken;
          token.if = errorWorld.symbols.pop();
          break;
        }
      }
    }
  }
  if (errorWorld.symbols.length > 0 && !elseCase) {
    syntaxError = true;
    token = errorWorld.symbols[0];
  }
  if (syntaxError) {
    return token;
  } else {
    return 0;
  }
}
