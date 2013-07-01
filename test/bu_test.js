Bu = require("../content/js/eg_test")

var tree
before(function() {
  function node(name,data,children) {
    data = data || {}
    data.content = "var a = 1 + 1;"
    return new Bu.Dsl.Node(name,data,children)
  }

  tree = node("descrbe",{name: "*root*"},[
    node("describe",{name: "scopeOne"},[
      node("scoped"),
      node("before"),
      node("after"),
      node("it",{name: "it1"}),
      node("describe",{name: "scopeThree"},[
        node("it",{name: "it2"})
      ]),
      node("it",{name: "it5"}) // this shouldn't be given to scopeThree
    ]),
    node("it",{name: "it3"}),
    node("describe",{name: "scopeTwo"}),
    node("it",{name: "it4"})
  ])
})

describe("Bu.Tree",function() {

  var testTree 

  function forLookup(tree) {
    tree.describes.forEach(function(d) {
      tree[d.name] = d
      forLookup(d)
    })
  }
  function testNames(scope) {
    return scope.tests.map(function(n) { return n.name })
  }

  before(function() {
    testTree = Bu.TestTree.dslToTree(tree)
    forLookup(testTree)
  })

  it("has top level describes at top level",function() {
    assert.defined( testTree.scopeOne )
    assert.defined( testTree.scopeTwo )
    refute.defined( testTree.scopeThree )
  })

  it("supports nested describes",function() {
    assert.defined( testTree.scopeOne.scopeThree )
  })

  it("can define befores",function() {
    assert.defined( testTree.scopeOne.before )
  })

  it("can define code to be run in describe scope",function() {
    assert.defined( testTree.scopeOne.scoped )
  })

  it("can group its at top level implicitly",function() {
    assert.contains( testNames(testTree.scopeOne), "it3" )
    refute.contains( testNames(testTree.scopeOne), "it4" )
    assert.contains( testNames(testTree.scopeTwo), "it4" )
    refute.contains( testNames(testTree.scopeTwo), "it3" )
  })

})

describe("Bu.Mocha.Bdd",function() {

  var code
  before(function() {
    var testTree = Bu.TestTree.dslToTree(tree)
    code = new Bu.Mocha.Bdd(testTree).javascript()
  })

  it("can generate code",function() {
    assert.match(code,'describe')
  })

  it("doesn't include root node",function() {
    refute.match(code,'*root*')
  })

})

