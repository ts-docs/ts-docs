/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 360:
/***/ (function(module, exports) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/*
WHAT: SublimeText-like Fuzzy Search

USAGE:
  fuzzysort.single('fs', 'Fuzzy Search') // {score: -16}
  fuzzysort.single('test', 'test') // {score: 0}
  fuzzysort.single('doesnt exist', 'target') // null

  fuzzysort.go('mr', ['Monitor.cpp', 'MeshRenderer.cpp'])
  // [{score: -18, target: "MeshRenderer.cpp"}, {score: -6009, target: "Monitor.cpp"}]

  fuzzysort.highlight(fuzzysort.single('fs', 'Fuzzy Search'), '<b>', '</b>')
  // <b>F</b>uzzy <b>S</b>earch
*/

// UMD (Universal Module Definition) for fuzzysort
;(function(root, UMD) {
  if(true) !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (UMD),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__))
  else {}
})(this, function UMD() { function fuzzysortNew(instanceOptions) {

  var fuzzysort = {

    single: function(search, target, options) {
      if(!search) return null
      if(!isObj(search)) search = fuzzysort.getPreparedSearch(search)

      if(!target) return null
      if(!isObj(target)) target = fuzzysort.getPrepared(target)

      var allowTypo = options && options.allowTypo!==undefined ? options.allowTypo
        : instanceOptions && instanceOptions.allowTypo!==undefined ? instanceOptions.allowTypo
        : true
      var algorithm = allowTypo ? fuzzysort.algorithm : fuzzysort.algorithmNoTypo
      return algorithm(search, target, search[0])
      // var threshold = options && options.threshold || instanceOptions && instanceOptions.threshold || -9007199254740991
      // var result = algorithm(search, target, search[0])
      // if(result === null) return null
      // if(result.score < threshold) return null
      // return result
    },

    go: function(search, targets, options) {
      if(!search) return noResults
      search = fuzzysort.prepareSearch(search)
      var searchLowerCode = search[0]

      var threshold = options && options.threshold || instanceOptions && instanceOptions.threshold || -9007199254740991
      var limit = options && options.limit || instanceOptions && instanceOptions.limit || 9007199254740991
      var allowTypo = options && options.allowTypo!==undefined ? options.allowTypo
        : instanceOptions && instanceOptions.allowTypo!==undefined ? instanceOptions.allowTypo
        : true
      var algorithm = allowTypo ? fuzzysort.algorithm : fuzzysort.algorithmNoTypo
      var resultsLen = 0; var limitedCount = 0
      var targetsLen = targets.length

      // This code is copy/pasted 3 times for performance reasons [options.keys, options.key, no keys]

      // options.keys
      if(options && options.keys) {
        var scoreFn = options.scoreFn || defaultScoreFn
        var keys = options.keys
        var keysLen = keys.length
        for(var i = targetsLen - 1; i >= 0; --i) { var obj = targets[i]
          var objResults = new Array(keysLen)
          for (var keyI = keysLen - 1; keyI >= 0; --keyI) {
            var key = keys[keyI]
            var target = getValue(obj, key)
            if(!target) { objResults[keyI] = null; continue }
            if(!isObj(target)) target = fuzzysort.getPrepared(target)

            objResults[keyI] = algorithm(search, target, searchLowerCode)
          }
          objResults.obj = obj // before scoreFn so scoreFn can use it
          var score = scoreFn(objResults)
          if(score === null) continue
          if(score < threshold) continue
          objResults.score = score
          if(resultsLen < limit) { q.add(objResults); ++resultsLen }
          else {
            ++limitedCount
            if(score > q.peek().score) q.replaceTop(objResults)
          }
        }

      // options.key
      } else if(options && options.key) {
        var key = options.key
        for(var i = targetsLen - 1; i >= 0; --i) { var obj = targets[i]
          var target = getValue(obj, key)
          if(!target) continue
          if(!isObj(target)) target = fuzzysort.getPrepared(target)

          var result = algorithm(search, target, searchLowerCode)
          if(result === null) continue
          if(result.score < threshold) continue

          // have to clone result so duplicate targets from different obj can each reference the correct obj
          result = {target:result.target, _targetLowerCodes:null, _nextBeginningIndexes:null, score:result.score, indexes:result.indexes, obj:obj} // hidden

          if(resultsLen < limit) { q.add(result); ++resultsLen }
          else {
            ++limitedCount
            if(result.score > q.peek().score) q.replaceTop(result)
          }
        }

      // no keys
      } else {
        for(var i = targetsLen - 1; i >= 0; --i) { var target = targets[i]
          if(!target) continue
          if(!isObj(target)) target = fuzzysort.getPrepared(target)

          var result = algorithm(search, target, searchLowerCode)
          if(result === null) continue
          if(result.score < threshold) continue
          if(resultsLen < limit) { q.add(result); ++resultsLen }
          else {
            ++limitedCount
            if(result.score > q.peek().score) q.replaceTop(result)
          }
        }
      }

      if(resultsLen === 0) return noResults
      var results = new Array(resultsLen)
      for(var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll()
      results.total = resultsLen + limitedCount
      return results
    },

    goAsync: function(search, targets, options) {
      var canceled = false
      var p = new Promise(function(resolve, reject) {
        if(!search) return resolve(noResults)
        search = fuzzysort.prepareSearch(search)
        var searchLowerCode = search[0]

        var q = fastpriorityqueue()
        var iCurrent = targets.length - 1
        var threshold = options && options.threshold || instanceOptions && instanceOptions.threshold || -9007199254740991
        var limit = options && options.limit || instanceOptions && instanceOptions.limit || 9007199254740991
        var allowTypo = options && options.allowTypo!==undefined ? options.allowTypo
          : instanceOptions && instanceOptions.allowTypo!==undefined ? instanceOptions.allowTypo
          : true
        var algorithm = allowTypo ? fuzzysort.algorithm : fuzzysort.algorithmNoTypo
        var resultsLen = 0; var limitedCount = 0
        function step() {
          if(canceled) return reject('canceled')

          var startMs = Date.now()

          // This code is copy/pasted 3 times for performance reasons [options.keys, options.key, no keys]

          // options.keys
          if(options && options.keys) {
            var scoreFn = options.scoreFn || defaultScoreFn
            var keys = options.keys
            var keysLen = keys.length
            for(; iCurrent >= 0; --iCurrent) { var obj = targets[iCurrent]
              var objResults = new Array(keysLen)
              for (var keyI = keysLen - 1; keyI >= 0; --keyI) {
                var key = keys[keyI]
                var target = getValue(obj, key)
                if(!target) { objResults[keyI] = null; continue }
                if(!isObj(target)) target = fuzzysort.getPrepared(target)

                objResults[keyI] = algorithm(search, target, searchLowerCode)
              }
              objResults.obj = obj // before scoreFn so scoreFn can use it
              var score = scoreFn(objResults)
              if(score === null) continue
              if(score < threshold) continue
              objResults.score = score
              if(resultsLen < limit) { q.add(objResults); ++resultsLen }
              else {
                ++limitedCount
                if(score > q.peek().score) q.replaceTop(objResults)
              }

              if(iCurrent%1000/*itemsPerCheck*/ === 0) {
                if(Date.now() - startMs >= 10/*asyncInterval*/) {
                  isNode?setImmediate(step):setTimeout(step)
                  return
                }
              }
            }

          // options.key
          } else if(options && options.key) {
            var key = options.key
            for(; iCurrent >= 0; --iCurrent) { var obj = targets[iCurrent]
              var target = getValue(obj, key)
              if(!target) continue
              if(!isObj(target)) target = fuzzysort.getPrepared(target)

              var result = algorithm(search, target, searchLowerCode)
              if(result === null) continue
              if(result.score < threshold) continue

              // have to clone result so duplicate targets from different obj can each reference the correct obj
              result = {target:result.target, _targetLowerCodes:null, _nextBeginningIndexes:null, score:result.score, indexes:result.indexes, obj:obj} // hidden

              if(resultsLen < limit) { q.add(result); ++resultsLen }
              else {
                ++limitedCount
                if(result.score > q.peek().score) q.replaceTop(result)
              }

              if(iCurrent%1000/*itemsPerCheck*/ === 0) {
                if(Date.now() - startMs >= 10/*asyncInterval*/) {
                  isNode?setImmediate(step):setTimeout(step)
                  return
                }
              }
            }

          // no keys
          } else {
            for(; iCurrent >= 0; --iCurrent) { var target = targets[iCurrent]
              if(!target) continue
              if(!isObj(target)) target = fuzzysort.getPrepared(target)

              var result = algorithm(search, target, searchLowerCode)
              if(result === null) continue
              if(result.score < threshold) continue
              if(resultsLen < limit) { q.add(result); ++resultsLen }
              else {
                ++limitedCount
                if(result.score > q.peek().score) q.replaceTop(result)
              }

              if(iCurrent%1000/*itemsPerCheck*/ === 0) {
                if(Date.now() - startMs >= 10/*asyncInterval*/) {
                  isNode?setImmediate(step):setTimeout(step)
                  return
                }
              }
            }
          }

          if(resultsLen === 0) return resolve(noResults)
          var results = new Array(resultsLen)
          for(var i = resultsLen - 1; i >= 0; --i) results[i] = q.poll()
          results.total = resultsLen + limitedCount
          resolve(results)
        }

        isNode?setImmediate(step):step()
      })
      p.cancel = function() { canceled = true }
      return p
    },

    highlight: function(result, hOpen, hClose) {
      if(result === null) return null
      if(hOpen === undefined) hOpen = '<b>'
      if(hClose === undefined) hClose = '</b>'
      var highlighted = ''
      var matchesIndex = 0
      var opened = false
      var target = result.target
      var targetLen = target.length
      var matchesBest = result.indexes
      for(var i = 0; i < targetLen; ++i) { var char = target[i]
        if(matchesBest[matchesIndex] === i) {
          ++matchesIndex
          if(!opened) { opened = true
            highlighted += hOpen
          }

          if(matchesIndex === matchesBest.length) {
            highlighted += char + hClose + target.substr(i+1)
            break
          }
        } else {
          if(opened) { opened = false
            highlighted += hClose
          }
        }
        highlighted += char
      }

      return highlighted
    },

    prepare: function(target) {
      if(!target) return
      return {target:target, _targetLowerCodes:fuzzysort.prepareLowerCodes(target), _nextBeginningIndexes:null, score:null, indexes:null, obj:null} // hidden
    },
    prepareSlow: function(target) {
      if(!target) return
      return {target:target, _targetLowerCodes:fuzzysort.prepareLowerCodes(target), _nextBeginningIndexes:fuzzysort.prepareNextBeginningIndexes(target), score:null, indexes:null, obj:null} // hidden
    },
    prepareSearch: function(search) {
      if(!search) return
      return fuzzysort.prepareLowerCodes(search)
    },



    // Below this point is only internal code
    // Below this point is only internal code
    // Below this point is only internal code
    // Below this point is only internal code



    getPrepared: function(target) {
      if(target.length > 999) return fuzzysort.prepare(target) // don't cache huge targets
      var targetPrepared = preparedCache.get(target)
      if(targetPrepared !== undefined) return targetPrepared
      targetPrepared = fuzzysort.prepare(target)
      preparedCache.set(target, targetPrepared)
      return targetPrepared
    },
    getPreparedSearch: function(search) {
      if(search.length > 999) return fuzzysort.prepareSearch(search) // don't cache huge searches
      var searchPrepared = preparedSearchCache.get(search)
      if(searchPrepared !== undefined) return searchPrepared
      searchPrepared = fuzzysort.prepareSearch(search)
      preparedSearchCache.set(search, searchPrepared)
      return searchPrepared
    },

    algorithm: function(searchLowerCodes, prepared, searchLowerCode) {
      var targetLowerCodes = prepared._targetLowerCodes
      var searchLen = searchLowerCodes.length
      var targetLen = targetLowerCodes.length
      var searchI = 0 // where we at
      var targetI = 0 // where you at
      var typoSimpleI = 0
      var matchesSimpleLen = 0

      // very basic fuzzy match; to remove non-matching targets ASAP!
      // walk through target. find sequential matches.
      // if all chars aren't found then exit
      for(;;) {
        var isMatch = searchLowerCode === targetLowerCodes[targetI]
        if(isMatch) {
          matchesSimple[matchesSimpleLen++] = targetI
          ++searchI; if(searchI === searchLen) break
          searchLowerCode = searchLowerCodes[typoSimpleI===0?searchI : (typoSimpleI===searchI?searchI+1 : (typoSimpleI===searchI-1?searchI-1 : searchI))]
        }

        ++targetI; if(targetI >= targetLen) { // Failed to find searchI
          // Check for typo or exit
          // we go as far as possible before trying to transpose
          // then we transpose backwards until we reach the beginning
          for(;;) {
            if(searchI <= 1) return null // not allowed to transpose first char
            if(typoSimpleI === 0) { // we haven't tried to transpose yet
              --searchI
              var searchLowerCodeNew = searchLowerCodes[searchI]
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
              typoSimpleI = searchI
            } else {
              if(typoSimpleI === 1) return null // reached the end of the line for transposing
              --typoSimpleI
              searchI = typoSimpleI
              searchLowerCode = searchLowerCodes[searchI + 1]
              var searchLowerCodeNew = searchLowerCodes[searchI]
              if(searchLowerCode === searchLowerCodeNew) continue // doesn't make sense to transpose a repeat char
            }
            matchesSimpleLen = searchI
            targetI = matchesSimple[matchesSimpleLen - 1] + 1
            break
          }
        }
      }

      var searchI = 0
      var typoStrictI = 0
      var successStrict = false
      var matchesStrictLen = 0

      var nextBeginningIndexes = prepared._nextBeginningIndexes
      if(nextBeginningIndexes === null) nextBeginningIndexes = prepared._nextBeginningIndexes = fuzzysort.prepareNextBeginningIndexes(prepared.target)
      var firstPossibleI = targetI = matchesSimple[0]===0 ? 0 : nextBeginningIndexes[matchesSimple[0]-1]

      // Our target string successfully matched all characters in sequence!
      // Let's try a more advanced and strict test to improve the score
      // only count it as a match if it's consecutive or a beginning character!
      if(targetI !== targetLen) for(;;) {
        if(targetI >= targetLen) {
          // We failed to find a good spot for this search char, go back to the previous search char and force it forward
          if(searchI <= 0) { // We failed to push chars forward for a better match
            // transpose, starting from the beginning
            ++typoStrictI; if(typoStrictI > searchLen-2) break
            if(searchLowerCodes[typoStrictI] === searchLowerCodes[typoStrictI+1]) continue // doesn't make sense to transpose a repeat char
            targetI = firstPossibleI
            continue
          }

          --searchI
          var lastMatch = matchesStrict[--matchesStrictLen]
          targetI = nextBeginningIndexes[lastMatch]

        } else {
          var isMatch = searchLowerCodes[typoStrictI===0?searchI : (typoStrictI===searchI?searchI+1 : (typoStrictI===searchI-1?searchI-1 : searchI))] === targetLowerCodes[targetI]
          if(isMatch) {
            matchesStrict[matchesStrictLen++] = targetI
            ++searchI; if(searchI === searchLen) { successStrict = true; break }
            ++targetI
          } else {
            targetI = nextBeginningIndexes[targetI]
          }
        }
      }

      { // tally up the score & keep track of matches for highlighting later
        if(successStrict) { var matchesBest = matchesStrict; var matchesBestLen = matchesStrictLen }
        else { var matchesBest = matchesSimple; var matchesBestLen = matchesSimpleLen }
        var score = 0
        var lastTargetI = -1
        for(var i = 0; i < searchLen; ++i) { var targetI = matchesBest[i]
          // score only goes down if they're not consecutive
          if(lastTargetI !== targetI - 1) score -= targetI
          lastTargetI = targetI
        }
        if(!successStrict) {
          score *= 1000
          if(typoSimpleI !== 0) score += -20/*typoPenalty*/
        } else {
          if(typoStrictI !== 0) score += -20/*typoPenalty*/
        }
        score -= targetLen - searchLen
        prepared.score = score
        prepared.indexes = new Array(matchesBestLen); for(var i = matchesBestLen - 1; i >= 0; --i) prepared.indexes[i] = matchesBest[i]

        return prepared
      }
    },

    algorithmNoTypo: function(searchLowerCodes, prepared, searchLowerCode) {
      var targetLowerCodes = prepared._targetLowerCodes
      var searchLen = searchLowerCodes.length
      var targetLen = targetLowerCodes.length
      var searchI = 0 // where we at
      var targetI = 0 // where you at
      var matchesSimpleLen = 0

      // very basic fuzzy match; to remove non-matching targets ASAP!
      // walk through target. find sequential matches.
      // if all chars aren't found then exit
      for(;;) {
        var isMatch = searchLowerCode === targetLowerCodes[targetI]
        if(isMatch) {
          matchesSimple[matchesSimpleLen++] = targetI
          ++searchI; if(searchI === searchLen) break
          searchLowerCode = searchLowerCodes[searchI]
        }
        ++targetI; if(targetI >= targetLen) return null // Failed to find searchI
      }

      var searchI = 0
      var successStrict = false
      var matchesStrictLen = 0

      var nextBeginningIndexes = prepared._nextBeginningIndexes
      if(nextBeginningIndexes === null) nextBeginningIndexes = prepared._nextBeginningIndexes = fuzzysort.prepareNextBeginningIndexes(prepared.target)
      var firstPossibleI = targetI = matchesSimple[0]===0 ? 0 : nextBeginningIndexes[matchesSimple[0]-1]

      // Our target string successfully matched all characters in sequence!
      // Let's try a more advanced and strict test to improve the score
      // only count it as a match if it's consecutive or a beginning character!
      if(targetI !== targetLen) for(;;) {
        if(targetI >= targetLen) {
          // We failed to find a good spot for this search char, go back to the previous search char and force it forward
          if(searchI <= 0) break // We failed to push chars forward for a better match

          --searchI
          var lastMatch = matchesStrict[--matchesStrictLen]
          targetI = nextBeginningIndexes[lastMatch]

        } else {
          var isMatch = searchLowerCodes[searchI] === targetLowerCodes[targetI]
          if(isMatch) {
            matchesStrict[matchesStrictLen++] = targetI
            ++searchI; if(searchI === searchLen) { successStrict = true; break }
            ++targetI
          } else {
            targetI = nextBeginningIndexes[targetI]
          }
        }
      }

      { // tally up the score & keep track of matches for highlighting later
        if(successStrict) { var matchesBest = matchesStrict; var matchesBestLen = matchesStrictLen }
        else { var matchesBest = matchesSimple; var matchesBestLen = matchesSimpleLen }
        var score = 0
        var lastTargetI = -1
        for(var i = 0; i < searchLen; ++i) { var targetI = matchesBest[i]
          // score only goes down if they're not consecutive
          if(lastTargetI !== targetI - 1) score -= targetI
          lastTargetI = targetI
        }
        if(!successStrict) score *= 1000
        score -= targetLen - searchLen
        prepared.score = score
        prepared.indexes = new Array(matchesBestLen); for(var i = matchesBestLen - 1; i >= 0; --i) prepared.indexes[i] = matchesBest[i]

        return prepared
      }
    },

    prepareLowerCodes: function(str) {
      var strLen = str.length
      var lowerCodes = [] // new Array(strLen)    sparse array is too slow
      var lower = str.toLowerCase()
      for(var i = 0; i < strLen; ++i) lowerCodes[i] = lower.charCodeAt(i)
      return lowerCodes
    },
    prepareBeginningIndexes: function(target) {
      var targetLen = target.length
      var beginningIndexes = []; var beginningIndexesLen = 0
      var wasUpper = false
      var wasAlphanum = false
      for(var i = 0; i < targetLen; ++i) {
        var targetCode = target.charCodeAt(i)
        var isUpper = targetCode>=65&&targetCode<=90
        var isAlphanum = isUpper || targetCode>=97&&targetCode<=122 || targetCode>=48&&targetCode<=57
        var isBeginning = isUpper && !wasUpper || !wasAlphanum || !isAlphanum
        wasUpper = isUpper
        wasAlphanum = isAlphanum
        if(isBeginning) beginningIndexes[beginningIndexesLen++] = i
      }
      return beginningIndexes
    },
    prepareNextBeginningIndexes: function(target) {
      var targetLen = target.length
      var beginningIndexes = fuzzysort.prepareBeginningIndexes(target)
      var nextBeginningIndexes = [] // new Array(targetLen)     sparse array is too slow
      var lastIsBeginning = beginningIndexes[0]
      var lastIsBeginningI = 0
      for(var i = 0; i < targetLen; ++i) {
        if(lastIsBeginning > i) {
          nextBeginningIndexes[i] = lastIsBeginning
        } else {
          lastIsBeginning = beginningIndexes[++lastIsBeginningI]
          nextBeginningIndexes[i] = lastIsBeginning===undefined ? targetLen : lastIsBeginning
        }
      }
      return nextBeginningIndexes
    },

    cleanup: cleanup,
    new: fuzzysortNew,
  }
  return fuzzysort
} // fuzzysortNew

// This stuff is outside fuzzysortNew, because it's shared with instances of fuzzysort.new()
var isNode =  true && typeof window === 'undefined'
// var MAX_INT = Number.MAX_SAFE_INTEGER
// var MIN_INT = Number.MIN_VALUE
var preparedCache = new Map()
var preparedSearchCache = new Map()
var noResults = []; noResults.total = 0
var matchesSimple = []; var matchesStrict = []
function cleanup() { preparedCache.clear(); preparedSearchCache.clear(); matchesSimple = []; matchesStrict = [] }
function defaultScoreFn(a) {
  var max = -9007199254740991
  for (var i = a.length - 1; i >= 0; --i) {
    var result = a[i]; if(result === null) continue
    var score = result.score
    if(score > max) max = score
  }
  if(max === -9007199254740991) return null
  return max
}

// prop = 'key'              2.5ms optimized for this case, seems to be about as fast as direct obj[prop]
// prop = 'key1.key2'        10ms
// prop = ['key1', 'key2']   27ms
function getValue(obj, prop) {
  var tmp = obj[prop]; if(tmp !== undefined) return tmp
  var segs = prop
  if(!Array.isArray(prop)) segs = prop.split('.')
  var len = segs.length
  var i = -1
  while (obj && (++i < len)) obj = obj[segs[i]]
  return obj
}

function isObj(x) { return typeof x === 'object' } // faster as a function

// Hacked version of https://github.com/lemire/FastPriorityQueue.js
var fastpriorityqueue=function(){var r=[],o=0,e={};function n(){for(var e=0,n=r[e],c=1;c<o;){var f=c+1;e=c,f<o&&r[f].score<r[c].score&&(e=f),r[e-1>>1]=r[e],c=1+(e<<1)}for(var a=e-1>>1;e>0&&n.score<r[a].score;a=(e=a)-1>>1)r[e]=r[a];r[e]=n}return e.add=function(e){var n=o;r[o++]=e;for(var c=n-1>>1;n>0&&e.score<r[c].score;c=(n=c)-1>>1)r[n]=r[c];r[n]=e},e.poll=function(){if(0!==o){var e=r[0];return r[0]=r[--o],n(),e}},e.peek=function(e){if(0!==o)return r[0]},e.replaceTop=function(o){r[0]=o,n()},e};
var q = fastpriorityqueue() // reuse this, except for async, it needs to make its own

return fuzzysortNew()
}) // UMD

// TODO: (performance) wasm version!?

// TODO: (performance) layout memory in an optimal way to go fast by avoiding cache misses

// TODO: (performance) preparedCache is a memory leak

// TODO: (like sublime) backslash === forwardslash

// TODO: (performance) i have no idea how well optizmied the allowing typos algorithm is


/***/ }),

/***/ 228:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
var search_1 = __webpack_require__(734);
var sidebar_1 = __webpack_require__(304);
var theme_1 = __webpack_require__(343);
theme_1.initTheme();
window.addEventListener("load", function () {
    var e_1, _a, e_2, _b;
    var _loop_1 = function (el) {
        el.onclick = function () {
            var _a;
            var body = (_a = el.parentElement) === null || _a === void 0 ? void 0 : _a.getElementsByClassName("collapsible-body")[0];
            if (!body)
                return;
            body.classList.toggle("open");
            var arrow = el.getElementsByClassName("collapsible-arrow")[0];
            if (arrow)
                arrow.classList.toggle("open");
        };
    };
    try {
        for (var _c = __values(document.getElementsByClassName("collapsible-trigger")), _d = _c.next(); !_d.done; _d = _c.next()) {
            var el = _d.value;
            _loop_1(el);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    var _loop_2 = function (tooltip) {
        var timeout;
        var tooltipContent = tooltip.getElementsByClassName("c-tooltip-content")[0];
        if (!tooltipContent || tooltipContent.classList.contains("open"))
            return { value: void 0 };
        tooltip.onmouseover = function () {
            if (timeout)
                clearTimeout(timeout);
            timeout = setTimeout(function () {
                tooltipContent.classList.add("open");
            }, 600);
        };
        tooltip.onmouseleave = function () {
            clearTimeout(timeout);
            tooltipContent.classList.remove("open");
        };
    };
    try {
        for (var _e = __values(document.getElementsByClassName("c-tooltip")), _f = _e.next(); !_f.done; _f = _e.next()) {
            var tooltip = _f.value;
            var state_1 = _loop_2(tooltip);
            if (typeof state_1 === "object")
                return state_1.value;
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
        }
        finally { if (e_2) throw e_2.error; }
    }
    var contentMain = document.getElementById("content-main");
    var searchMenu = document.getElementById("search-menu");
    var searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("search"))
        searchMenu.classList.remove("d-none");
    else
        contentMain.classList.remove("d-none");
    search_1.initSearch(searchParams, contentMain, searchMenu);
    var scrollToTopBtn = document.getElementById("to-top");
    var content = document.getElementById("content");
    content.addEventListener("scroll", function () {
        if (content.scrollTop > 600 || content.scrollTop > 600) {
            scrollToTopBtn.style.display = "block";
        }
        else {
            scrollToTopBtn.style.display = "none";
        }
    });
    scrollToTopBtn.onclick = function () { return content.scroll({ top: 0, behavior: "smooth" }); };
    sidebar_1.initSidebar(contentMain);
});


/***/ }),

/***/ 734:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initSearch = void 0;
var fuzzysort_1 = __webpack_require__(360);
;
function hasBit(bits, bit) {
    return (bits & bit) === bit;
}
var searchTerm = "";
var searchData = [];
var searchResults;
function initSearch(search, contentMain, searchMenu) {
    return __awaiter(this, void 0, void 0, function () {
        var searchBar, options_1, val, timeout_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    searchBar = document.getElementById("search");
                    if (!searchBar) return [3, 5];
                    window.onkeypress = function () {
                        searchBar.focus();
                    };
                    options_1 = getSearchOptions();
                    window.onpopstate = function (event) {
                        if (event.state && event.state.search) {
                            contentMain.classList.add("d-none");
                            searchMenu.classList.remove("d-none");
                            evaluateSearch(event.state.search, options_1);
                        }
                        else {
                            contentMain.classList.remove("d-none");
                            searchMenu.classList.add("d-none");
                        }
                    };
                    if (!search.has("search")) return [3, 2];
                    val = search.get("search");
                    searchBar.value = val;
                    return [4, loadSearchData()];
                case 1:
                    _a.sent();
                    evaluateSearch(val, options_1);
                    return [3, 4];
                case 2: return [4, loadSearchData()];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    searchBar.oninput = function (ev) { return __awaiter(_this, void 0, void 0, function () {
                        var target, searchTerm;
                        var _this = this;
                        return __generator(this, function (_a) {
                            target = ev.target;
                            searchTerm = target.value.trim();
                            if (!searchTerm.length) {
                                clearTimeout(timeout_1);
                                searchMenu.classList.add("d-none");
                                contentMain.classList.remove("d-none");
                                return [2];
                            }
                            if (timeout_1)
                                clearTimeout(timeout_1);
                            timeout_1 = setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            history.pushState({ search: searchTerm }, "", "?search=" + searchTerm);
                                            return [4, evaluateSearch(searchTerm, options_1)];
                                        case 1:
                                            _a.sent();
                                            contentMain.classList.add("d-none");
                                            searchMenu.classList.remove("d-none");
                                            return [2];
                                    }
                                });
                            }); }, 400);
                            return [2];
                        });
                    }); };
                    _a.label = 5;
                case 5: return [2];
            }
        });
    });
}
exports.initSearch = initSearch;
function search(term, filteredResults) {
    if (!searchData)
        return [];
    var res = fuzzysort_1.go(term, filteredResults, { key: "name", allowTypo: true, limit: 150, threshold: -5000 });
    return res.map(function (r) {
        r.obj.highlighted = fuzzysort_1.highlight(r, '<span style="border-bottom: dotted 2px var(--primaryLight)">', "</span>");
        return r.obj;
    });
}
function evaluateSearch(term, options) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!searchData)
                return [2];
            searchTerm = term;
            searchResults = search(term, filterResults(options, searchData));
            displayResults(searchResults);
            return [2];
        });
    });
}
function filterResults(options, data) {
    var e_1, _a;
    var newRes = [];
    try {
        for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {
            var res = data_1_1.value;
            if (options.thisModuleOnly.checked && window.lm && res.path[0] !== window.lm)
                continue;
            if (!options.privates.checked && res.isPrivate)
                continue;
            if (!options.classes.checked && res.type === 0)
                continue;
            if (!options.interfaces.checked && res.type === 1)
                continue;
            if (!options.enums.checked && res.type === 2)
                continue;
            if (!options.functions.checked && res.type === 3)
                continue;
            if (!options.types.checked && res.type === 5)
                continue;
            if (!options.constants.checked && res.type === 4)
                continue;
            if (!options.properties.checked && (res.type === 6 || res.type === 7))
                continue;
            if (res.type === 8) {
                if (!options.methods.checked)
                    continue;
                if (!options.setters.checked && res.isSetter)
                    continue;
                if (!options.getters.checked && res.isGetter)
                    continue;
            }
            if (!options.enumMembers.checked && res.type === 9)
                continue;
            newRes.push(res);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return newRes;
}
function getSearchOptions() {
    var options = {
        classes: document.getElementById("search-option-classes"),
        interfaces: document.getElementById("search-option-interfaces"),
        enums: document.getElementById("search-option-enums"),
        functions: document.getElementById("search-option-functions"),
        constants: document.getElementById("search-option-constants"),
        types: document.getElementById("search-option-types"),
        properties: document.getElementById("search-option-properties"),
        methods: document.getElementById("search-option-methods"),
        enumMembers: document.getElementById("search-option-enum-members"),
        thisModuleOnly: document.getElementById("search-option-this-module-only"),
        setters: document.getElementById("search-option-setters"),
        getters: document.getElementById("search-option-getters"),
        privates: document.getElementById("search-option-privates")
    };
    options.classes.onchange =
        options.interfaces.onchange =
            options.enums.onchange =
                options.functions.onchange =
                    options.constants.onchange =
                        options.types.onchange =
                            options.properties.onchange =
                                options.methods.onchange =
                                    options.enumMembers.onchange =
                                        options.setters.onchange =
                                            options.getters.onchange =
                                                options.privates.onchange =
                                                    options.thisModuleOnly.onchange = function () { return evaluateSearch(searchTerm, options); };
    return options;
}
function formatResult(res) {
    var path = res.path.slice();
    var content = "";
    switch (res.type) {
        case 0: {
            content = "<div>\n            <span class=\"keyword\">class</span>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/class/" + res.name + ".html\" class=\"item-name object\">" + res.highlighted + "<a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 1: {
            content = "<div>\n            <span class=\"keyword\">interface</span>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/interface/" + res.name + ".html\" class=\"item-name object\">" + res.highlighted + "<a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 2: {
            content = "<div>\n            <span class=\"keyword\">enum</span>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/enum/" + res.name + ".html\" class=\"item-name object\">" + res.highlighted + "<a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 3: {
            content = "<div>\n            <span class=\"keyword\">function</span>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/function/" + res.name + ".html\" class=\"item-name method-name\">" + res.highlighted + "<a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 5: {
            content = "<div>\n            <span class=\"keyword\">type</span>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/type/" + res.name + ".html\" class=\"item-name object\">" + res.highlighted + "<a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 4: {
            content = "<div>\n            <span class=\"keyword\">const</span>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/constant/" + res.name + ".html\" class=\"item-name object\">" + res.highlighted + "<a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 6: {
            content = "<div>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/class/" + res.obj + ".html#." + res.name + "\"><span class=\"item-name object\">" + res.obj + "</span><span class=\"symbol\">.</span><span class=\"item-name property-name\">" + res.highlighted + "</span></a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 8: {
            content = "<div>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/class/" + res.obj + ".html#." + res.name + "\">" + (res.isGetter ? '<span class="keyword">get</span> ' : "") + (res.isSetter ? '<span class="keyword">set</span> ' : "") + "<span class=\"item-name object\">" + res.obj + "</span><span class=\"symbol\">.</span><span class=\"item-name method-name\">" + res.highlighted + "</span></a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 7: {
            content = "<div>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/interface/" + res.obj + ".html#." + res.name + "\" class=\"item-name property-name\"><span class=\"item-name object\">" + res.obj + "</span><span class=\"symbol\">.</span><span class=\"item-name property-name\">" + res.highlighted + "</span></a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
        case 9: {
            content = "<div>\n            <a href=\"" + window.depth + path.map(function (m) { return "m." + m; }).join("/") + "/enum/" + res.obj + ".html#." + res.name + "\"><span class=\"item-name object\">" + res.obj + "</span><span class=\"symbol\">.</span><span class=\"item-name item-name\">" + res.highlighted + "</span></a>\n            " + (path.length ? "<p class=\"docblock secondary\">In " + path.join("/") + "</p>" : "") + "\n            </div>";
            break;
        }
    }
    return "<div class=\"search-result\">" + content + "</div>";
}
function displayResults(results) {
    var searchResults = document.getElementById("search-result-list");
    if (!results.length) {
        searchResults.innerHTML = "<h1 class=\"text-center\">No results!</h1>";
        return;
    }
    var mid = Math.ceil(results.length / 2);
    searchResults.innerHTML = "\n    <div class=\"row\">\n    <div class=\"col-lg-6\">\n    " + results.slice(0, mid).map(function (h) { return formatResult(h); }).join("") + "\n    </div>\n    <div class=\"col-lg-6\">\n    " + results.slice(-mid).map(function (h) { return formatResult(h); }).join("") + "\n    </div>\n    </div>\n    ";
}
function loadSearchData() {
    return __awaiter(this, void 0, void 0, function () {
        var req, data, moduleNames, _a, _b, module_1;
        var e_2, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4, fetch(window.depth + "assets/search.json", {
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    })];
                case 1:
                    req = _d.sent();
                    return [4, req.json()];
                case 2:
                    data = _d.sent();
                    moduleNames = data[1];
                    try {
                        for (_a = __values(data[0]), _b = _a.next(); !_b.done; _b = _a.next()) {
                            module_1 = _b.value;
                            searchData.push.apply(searchData, __spreadArray([], __read(module_1[1].map(function (cl) {
                                var path = cl[3].map(function (p) { return moduleNames[p]; });
                                searchData.push.apply(searchData, __spreadArray([], __read(cl[1].map(function (_a) {
                                    var _b = __read(_a, 2), name = _b[0], bits = _b[1];
                                    return ({ name: name, path: path, obj: cl[0], type: 6, isPrivate: hasBit(bits, 4) });
                                }))));
                                searchData.push.apply(searchData, __spreadArray([], __read(cl[2].map(function (_a) {
                                    var _b = __read(_a, 2), name = _b[0], bits = _b[1];
                                    return ({ name: name, path: path, obj: cl[0], type: 8, isGetter: hasBit(bits, 1), isSetter: hasBit(bits, 2), isPrivate: hasBit(bits, 4) });
                                }))));
                                return {
                                    name: cl[0],
                                    path: path,
                                    type: 0
                                };
                            }))));
                            searchData.push.apply(searchData, __spreadArray([], __read(module_1[2].map(function (inter) {
                                var path = inter[2].map(function (p) { return moduleNames[p]; });
                                searchData.push.apply(searchData, __spreadArray([], __read(inter[1].map(function (p) { return ({ name: p, path: path, obj: inter[0], type: 7 }); }))));
                                return {
                                    name: inter[0],
                                    path: path,
                                    type: 1
                                };
                            }))));
                            searchData.push.apply(searchData, __spreadArray([], __read(module_1[3].map(function (en) {
                                var path = en[2].map(function (p) { return moduleNames[p]; });
                                searchData.push.apply(searchData, __spreadArray([], __read(en[1].map(function (p) { return ({ name: p, path: path, obj: en[0], type: 9 }); }))));
                                return {
                                    name: en[0],
                                    path: path,
                                    type: 2
                                };
                            }))));
                            searchData.push.apply(searchData, __spreadArray([], __read(module_1[4].map(function (t) { return ({ name: t[0], path: t[1].map(function (p) { return moduleNames[p]; }), type: 5 }); }))));
                            searchData.push.apply(searchData, __spreadArray([], __read(module_1[5].map(function (t) { return ({ name: t[0], path: t[1].map(function (p) { return moduleNames[p]; }), type: 3 }); }))));
                            searchData.push.apply(searchData, __spreadArray([], __read(module_1[6].map(function (t) { return ({ name: t[0], path: t[1].map(function (p) { return moduleNames[p]; }), type: 4 }); }))));
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return [2];
            }
        });
    });
}


/***/ }),

/***/ 304:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initSidebar = void 0;
function initSidebar(contentMain) {
    var sidebarBtn = document.getElementById("sidebar-arrow");
    if (!sidebarBtn)
        return;
    var sidebar = document.getElementById("sidebar");
    sidebarBtn.onclick = function () {
        sidebar.classList.add("d-block");
        sidebarBtn.classList.add("d-none");
    };
    contentMain.addEventListener("click", function () {
        if (window.innerWidth > 680)
            return;
        sidebar.classList.remove("d-block");
        sidebarBtn.classList.remove("d-none");
    });
}
exports.initSidebar = initSidebar;


/***/ }),

/***/ 343:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.initTheme = void 0;
var Themes = {
    dark: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-moon-fill" viewBox="0 0 16 16"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/></svg>',
    light: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-brightness-high-fill" viewBox="0 0 16 16"><path d="M12 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>'
};
var currentTheme;
function setTheme(themeName, saveChoice, icon) {
    document.documentElement.dataset.theme = themeName;
    if (saveChoice)
        localStorage.setItem("theme", themeName);
    currentTheme = themeName;
    if (icon) {
        if (themeName === "light")
            icon.innerHTML = Themes.dark;
        else
            icon.innerHTML = Themes.light;
    }
}
function oppositeOfCurrentTheme() {
    if (currentTheme === "dark")
        return "light";
    return "dark";
}
function initTheme() {
    var theme = localStorage.getItem("theme");
    if (!theme) {
        if (window.matchMedia("(prefers-color-scheme: dark)").matches)
            theme = "dark";
        else
            theme = "light";
    }
    setTheme(theme, false);
    window.addEventListener("load", function () {
        var icon = document.getElementById("theme-icon");
        icon.innerHTML = Themes[oppositeOfCurrentTheme()];
        icon.onclick = function () { return setTheme(oppositeOfCurrentTheme(), true, icon); };
    });
}
exports.initTheme = initTheme;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(228);
/******/ 	
/******/ })()
;