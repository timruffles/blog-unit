/*
 * BlogUnit 0.0.1
 * @author Tim Ruffles, @timruffles, truffles.me.uk
 */
;(function(global) {

var Bu = global.Bu || {}

Bu.prepareForReading = function(el) {
  el = el || document.body
  var dom = new Bu.Dom(el)
  var dsl = dom.asDsl()
  var testTree = Bu.TestTree.dslToTree(dsl)
  var sourceCode = Bu.Mocha.Bdd.treeToJavascript(testTree)
  var ui = new Bu.Ui(dsl.toplevelNodes())
  ui.display()
  Bu.Mocha.run(sourceCode,function(results) {
    ui.results(results,testTree)
  })
}

Bu.setPrettifier = function(fn) {
  Bu.prettifyQueue.forEach(fn)
  Bu.prettify = fn
}

Bu.prettifyQueue = []
Bu.prettify = function(el) {
  Bu.prettifyQueue.push(el)
}

Bu.onPage = function(el) {
  el = el || document.body
  var scripts = el.getElementsByTagName("script")
  if([].some.call(scripts,function(s) { return s.hasAttribute("data-read-eg-tests") })) {
    Bu.prepareForReading(el)
  }
}

function find(arr,fn) {
  for(var i = 0, len = arr.length; i < len; i += 1) {
    if(fn(arr[i])) return arr[i]
  }
}


// Ui
Bu.Ui = function(nodes,runner) {
  this.nodes = nodes
  this.views = []
  this.runner = runner
}

Bu.Ui.Annotation = function(node) {
  this.node = node
  this.passes = []
  this.failures = []
}
function pluralize(str,n) {
  n = n == null ? 2 : n
  if(n === 1) return str
  if(/s$/.test(str)) return str + "es"
  return str + "s"
}
Bu.Ui.Annotation.prototype = {
  render: function() {
    var el = document.createElement("div")
    el.classList.add("eg-annotation")
    insertAfter(this.node.el,el)
    this.el = el
  },
  renderResults: function() {
    var el = document.createElement("span")
    el.classList.add("result")
    var passes = this.passes.length
    var failures = this.failures.length
    el.innerHTML = passes + " " + pluralize("pass",passes) + ", " + failures + " " + pluralize("failure",failures)
    prepend(el,this.el)
    if(failures === 0 && passes > 0) {
      this.el.classList.add("passed")
    } else {
      this.el.classList.add("failed")
    }
  },
  passesAdd: function(test) {
    this.passes.push(test)
  },
  failuresAdd: function(test) {
    this.failures.push(test)
  },
  collapse: function() {
    var collapse = function(el) {
      return [].reduce.call(el.childNodes,function(str,child) {
        if(child.constructor === Text) return str + child.textContent
        return str + collapse(child)
      },"")
    }
    this.node.el.innerHTML = collapse(this.node.el)
    Bu.prettify(this.node.el)
  }
}

function isDslNodeOrContainsIt(node,needle) {
  if(node.type === "it") return node === needle
  if(node.type === "describe") return node.children.some(function(c) { return isDslNodeOrContainsIt(c,needle) })
  return false
}

Bu.Ui.prototype = {
  results: function(results,testTree) {
    // for result
    var _this = this;
    var byKey = Bu.TestTree.byKey(testTree)
    ;["passes","failures"].forEach(function(resultType) {
      results[resultType].forEach(function(test) {
        var node = byKey[test.key]
        var source = node.source
        var container = find(_this.views,function(v) {
          return isDslNodeOrContainsIt(v.node,source)
        })
        // annotate
        container[resultType + "Add"](test)
      })
    })
    this.views.forEach(function(v) { v.renderResults() })
  },
  display: function() {
    this.views = this.nodes.map(function(n) { return new Bu.Ui.Annotation(n) })
    this.views.forEach(function(v) {
      v.collapse()
      v.render()
    })
  }
}

// Dom
Bu.Dom = function(el,opts) {
  this.el = el
  opts = opts || {}
  this.opts = opts
}

function fromAttribute(attribute,fn) {
  return function(el) {
    var val = el.getAttribute(attribute)
    if(val) return fn.call(this,el,val)
  }
}
function hasAttribute(attribute,fn) {
  return function(el) {
    if(el.hasAttribute(attribute)) return fn.call(this,el)
  }
}
function codeNode(type,attribute) {
  return hasAttribute(attribute,function(el) {
    assert(el.children.length === 0,type + " nodes should have no child elements - just code")
    return {type: type,content: this.getCode(el)}
  })
}

Bu.Dom.Root = function(attrs) {
  extend(this,attrs)
  return this
}
Bu.Dom.Root.prototype = {
  toplevelNodes: function() {
    return this.children.filter(function(node) {
      return node.type === "describe" || node.type === "it"
    })
  }
}

Bu.Dom.prototype = {
  asDsl: immutableProperty("_asDom",function() {
    var _this = this
    var children = []
    ;[].forEach.call(this.el.children,function(el) {
      var wasDslNode = ["describe","it","scoped","after","before"].some(function(matcher) {
        var node = _this[matcher](el)
        if(node) children.push(node)
        return node
      })
      if(!wasDslNode) {
        var childDsl = new Bu.Dom(el,_this.opts)
        children = children.concat( childDsl.asDsl().children )
      }
    })
    return new Bu.Dom.Root({type: "describe",name: "*root*", children: children})
  }),
  getCode: function(el) {
    return el.innerHTML.trim().replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&amp;/g,"&")
  },
  cleanAttribute: function(attr) {
    return attr.trim()
  },
  describe: fromAttribute("data-describe",function(el,describe) {
    return {type:"describe",children: new Bu.Dom(el).asDsl().children,name: this.cleanAttribute(describe), el: el}
  }),
  it: fromAttribute("data-it",function(el,it) {
    return {type: "it",content: this.getCode(el), name: this.cleanAttribute(it), el: el}
  }),
  scoped: codeNode("scoped","data-scoped"),
  after: codeNode("after","data-after"),
  afterEach: codeNode("afterEach","data-after-each"),
  before: codeNode("before","data-before"),
  beforeEach: codeNode("beforeEach","data-before-each")
}

// Dsl
Bu.Dsl = {}

Bu.Dsl.Node = function(type,data,children) {
  if(data) assert(typeof data === "object","Expects data to be an object")
  if(children) assert(typeof children.forEach === "function","Expects children to an array")
  return extend(data || {},{type: type,children: children || []})
}

// test tree
Bu.TestTree = {}
Bu.TestTree.dslToTree = function(node,root) {
  var topLevel = !root
  var root = root || {name: "*root*",tests: [], describes: [],type: "describe",source: node}
  var describeContext = root
  node.children.forEach(function(node) {
    switch(node.type) {
    case "describe":
      var testNode = {name: node.name, type: "describe",tests: [],describes: [], source: node}
      root.describes.push(testNode)
      if(topLevel) describeContext = testNode
      return Bu.TestTree.dslToTree(node,testNode) 
    case "it":
      var testNode = pick(node,"type","content","name")
      testNode.source = node
      return describeContext.tests.push(testNode)
    default:
      var testNode = pick(node,"type","content")
      testNode.source = node
      return describeContext[node.type] = testNode
    }
  })
  return root
}
Bu.TestTree.byKey = function(root) {
  var byKey = {}
  var walker = function(node,path) {
    if(!(node.type in {describe:1,it:1})) return
    if(path) {
      path = path.concat(node.name)
    } else {
      path = []
    }
    byKey[Bu.testLookupKey(path)] = node
    if(node.describes) node.describes.forEach(function(c) { walker(c,path) })
    if(node.tests) node.tests.forEach(function(c) { walker(c,path) })
  }
  walker(root)
  return byKey
}

Bu.Mocha = {}
Bu.Mocha.Bdd = function(tree) {
  this.tree = tree
  this.indentLevel = 0;
}
Bu.Mocha.Bdd.treeToJavascript = function(tree) {
  return new Bu.Mocha.Bdd(tree).javascript()
}
function simpleContentNode(name) {
  return function(node) {
    return this.i(name + '(function() {\n') + this.i(node.content + '\n',1) + 
      this.i('})\n')
  }
}
Bu.Mocha.Bdd.prototype = {
  javascript: function() {
    return this.describe(this.tree)
  },
  describe: function(node) {
    var _this = this
    var output = []
    var root = node.name === "*root*"
    if(!root) {
      output.push( this.i('describe("' + node.name + '",function() {\n') )
      this.outdent()
    }
    output.push([
      node.scoped ? this.scoped(node.scoped) : '',
      node.before ? this.before(node.before) : '',
      node.after ? this.after(node.after) : '',
      node.tests.reduce(function(str,it) {
        return str + _this.it(it)
      },''),
      node.describes.reduce(function(str,it) {
        return str + _this.describe(it)
      },'')
    ].join(""))
    if(!root) {
      this.indent()
      output.push( this.i('})\n') )
    }
    return output.join("")
  },
  i: function(str,n) {
    return repeatString("  ",this.indentLevel + (n || 0)) + str
  },
  indent: function() { this.indentLevel -= 1 },
  outdent: function() { this.indentLevel += 1 },
  it: function(node) {
    return this.i('it("' + node.name + '",function() {\n')
      + this.i(node.content + '\n',1) + this.i('})\n')
  },
  before: simpleContentNode("before"),
  beforeEach: simpleContentNode("beforeEach"),
  after: simpleContentNode("after"),
  afterEach: simpleContentNode("afterEach"),
  scoped: function(node) {
    return this.i(node.content + '\n')
  },
  byType: function(node) {
    var handler = this[node.type]
    if(handler) return this[node.type](node)
    throw new Error("Have no handler for " + node.type + " nodes")
  }
}

Bu.testLookupKey = function(components) {
  return components.join("-$-")
}

Bu.Mocha.Reporter = function(fn) {
  this.passes = []
  this.failures = []
  this.end = fn
  return this
}
Bu.Mocha.Reporter.prototype = {
  formatTest: function(test) {
    var current = test
    var key = [test.title]
    while(!current.parent.root) {
      current = current.parent
      key.push(current.title)
    }
    return {key: Bu.testLookupKey(key.reverse()), test: test}
  },
  reporterFunction: function() {
    var _this = this
    return function(runner,root) {
      runner.on('pass', function(test){
        _this.passes.push(_this.formatTest(test))
      })
      runner.on('fail', function(test, err){
        _this.failures.push(_this.formatTest(test))
      })
      runner.on('end',function() { _this.end(_this) })
    }
  }
}

Bu.Mocha.run = function(code,done) {
  mocha.setup("bdd")
  var reporter = new Bu.Mocha.Reporter(done)
  mocha._reporter = reporter.reporterFunction()
  eval(code)
  mocha.run()
}

function extend(o) {
  return [].slice.call(arguments,1).reverse().reduce(function(extended,obj) {
    for(var k in obj) extended[k] = obj[k]
    return extended
  },o)
}
function copy(o) {
  return extend({},o)
}
function assert(t,msg) {
  if(!t) throw new Error(msg)
}
function omit(o) {
  var keys = [].slice.call(arguments,1).reduce(function(o,k) { o[k] = 1; return o },{})
  var omitted = {}
  for(var k in o) {
    if(keys[k]) continue
    omitted[k] = o[k]
  }
  return omitted
}
function pick(o) {
  var keys = [].slice.call(arguments,1).reduce(function(o,k) { o[k] = 1; return o },{})
  var picked = {}
  for(var k in o) {
    if(!keys[k]) continue
    picked[k] = o[k]
  }
  return picked
}
function walk(obj,fn) {
  for(var k in obj) fn(k,obj[k])
}
function repeatString(str,n) {
  var output = new Array(n)
  while(n--) output[n] = str
  return output.join("")
}
function immutableProperty(prop,fn) {
  assert(fn.length === 0,"Can't have an immutable property that takes arguments")
  return function() {
    if(this[prop] !== undefined) return this[prop];
    return this[prop] = fn.call(this)
  }
}
function insertAfter(el,insertEl) {
  if(el.nextElementSibling) return el.parentElement.insertBefore(insertEl,el.nextElementSibling)
  el.parentNode.appendChild(insertEl)
}
function prepend(el,container) {
  if(container.children.length === 0) return container.appendChild(el)
  container.insertBefore(el,container.children[0])
}
if(!String.prototype.trim) String.prototype.trim = function() {
  return this.replace(/^\s+|\s+$/g,'')
}

this.Bu = Bu
if(typeof module !== "undefined") module.exports = Bu

if(typeof window !== "undefined") {
  Bu.onPage(document.body)
  var assert = this.assert = function(t) {
    if(!t) throw new Error("fail")
  }
  var refute = this.refute = function(t) {
    if(t) throw new Error("fail")
  }
  assert.equal = function(a,b) { 
    if(a.forEach) {
      if(!b.forEach) return false
      if(a.length !== b.length) return false
      return a.every(function(v,i) { assert.equal(v,b[i]) })
    }
    assert(a === b)
  }
}


})(this)
