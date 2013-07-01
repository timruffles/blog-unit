var testHtmlSource = 
  '<div><div data-describe="scopeOne">' +
  '  <div data-scoped>' +
  '    function shouldBeVisibleInScopeOneCode(weight) {' +
  '    }' +
  '  </div>' +
  '  <div data-before>' +
  '    shouldBeVisibleInScopeOneCode()' +
  '  </div>' +
  '  <div data-after>' +
  '    shouldBeVisibleInScopeOneCode()' +
  '  </div>' +
  '  <div data-it="isTheFirstTestInScopeOne">' +
  '    if(!(typeof shouldBeVisibleInScopeOneCode === "function")) {' +
  '      throw new Error("Can not see variables in describe scope when nesting")' +
  '    }' +
  '  </div>' +
  '  <div data-describe="scopeThree">' +
  '    <div data-it="firstTestInScopeThree">' +
  '      if(!(typeof shouldBeVisibleInScopeOneCode === "function")) {' +
  '        throw new Error("Can not see variables in parent scope when nesting")' +
  '      }' +
  '    </div>' +
  '  </div>' +
  '</div>' +
  '<div data-it="implicitlyInScopeOne">' +
  '  if(!(typeof shouldBeVisibleInScopeOneCode === "function")) {' +
  '    throw new Error("Can not see variables in describe scope when nesting")' +
  '  }' +
  '</div>' +
  '<div data-describe="scopeTwo"></div>' +
  '<div data-it="implicitlyInScopeTwo">' +
  '  if(typeof shouldBeVisibleInScopeOneCode === "function") {' +
  '    throw new Error("Can see variables another describe scope")' +
  '  }' +
  '</div></div>'

describe("Bu.Dom",function() {
  

  var parsed;
  before(function() {
    parsed = new Bu.Dom($(testHtmlSource)[0]).asDsl()
  })

  it("reads top level describes",function() {
    assert(parsed.children.some(function(node) {
      return node.type === "describe" && node.name === "scopeTwo"
    }))
  })

  it("reads describes recursively and assigns its",function() {
    var scopeOne
    var scopeThree
    var testInScopeThree
    parsed.children.forEach(function(node) {
      if(node.type === "describe" && node.name === "scopeOne") scopeOne = node
    })
    assert(scopeOne,"didn't find scope one")
    scopeOne.children.forEach(function(node) {
      if(node.type === "describe" && node.name === "scopeThree") scopeThree = node
    })
    assert(scopeThree,"didn't find scope three")
    scopeThree.children.forEach(function(node) {
      if(node.type === "it" && node.name === "firstTestInScopeThree") testInScopeThree = node
    })
    assert(testInScopeThree,"didn't find test")
  })

})

describe("Bu",function() {
  var sourceCode
  before(function() {
    var dom = $(testHtmlSource)[0]
    var parsed = new Bu.Dom(el,opts).asDsl()
    var testTree = Bu.TestTree.dslToTree(parsed)
    sourceCode = Bu.Mocha.Bdd.treeToJavascript(testTree)
  })

  it("generates source",function() {
    assert( /firstTestInScopeThree/.test(sourceCode) )
  })
})

function assert(t,msg) {
  if(!t) throw new Error(msg || "fail")
}
