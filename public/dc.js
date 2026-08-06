/*
 * dc.js — minimal self-hosted runtime for the Claude Design "x-dc" template format.
 *
 * Renders the template in <script type="text/x-template" id="dc-template"> against
 * the value dictionary returned by Component.renderVals() (see logic.js), using the
 * locally bundled React UMD build. Supports:
 *   {{path.to.value}}   bindings in text, attributes and style declarations
 *   <sc-if value="{{cond}}">…</sc-if>
 *   <sc-for list="{{items}}" as="x">…</sc-for>   (nested scopes supported)
 *
 * <select>/<option> are pre-renamed to <dc-select>/<dc-option> before parsing so the
 * HTML parser cannot drop <sc-for> elements nested inside a select, then mapped back
 * when creating React elements.
 */
(function () {
  'use strict';

  var PROPS = { scrambleLength: 20, quizChoices: 4, quizSeconds: 10 };

  var TAG_MAP = { 'dc-select': 'select', 'dc-option': 'option' };
  var EVENT_MAP = {
    onclick: 'onClick', onchange: 'onChange', oninput: 'onInput',
    onpointerdown: 'onPointerDown', onpointerup: 'onPointerUp',
    onpointercancel: 'onPointerCancel', oncontextmenu: 'onContextMenu'
  };
  var BIND = /\{\{([^}]+)\}\}/g;

  function resolvePath(expr, scope, vals) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    var segs = expr.split('.');
    var v = (scope && segs[0] in scope) ? scope : vals;
    for (var i = 0; i < segs.length; i++) {
      if (v == null) return undefined;
      v = v[segs[i]];
    }
    return v;
  }

  function strOf(v) { return v == null ? '' : String(v); }

  // Split a string into literal parts and {e: expr} binding parts.
  function toParts(str) {
    var out = [], last = 0, m;
    BIND.lastIndex = 0;
    while ((m = BIND.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push({ e: m[1] });
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }

  // Attribute/value string -> fn(scope, vals). A single pure binding returns the raw
  // resolved value (function, element, boolean, …); mixed content joins to a string.
  function compileValue(str) {
    var ps = toParts(str);
    if (ps.length === 1 && typeof ps[0] === 'object') {
      var e = ps[0].e;
      return function (sc, vals) { return resolvePath(e, sc, vals); };
    }
    var isStatic = ps.every(function (p) { return typeof p === 'string'; });
    if (isStatic) {
      var s = ps.join('');
      return function () { return s; };
    }
    return function (sc, vals) {
      var out = '';
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        out += typeof p === 'string' ? p : strOf(resolvePath(p.e, sc, vals));
      }
      return out;
    };
  }

  function camel(prop) {
    if (prop.slice(0, 2) === '--') return prop;
    return prop.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
  }

  function compileStyle(str) {
    var decls = [];
    var dynamic = false;
    str.split(';').forEach(function (d) {
      var i = d.indexOf(':');
      if (i < 0) return;
      var p = d.slice(0, i).trim();
      if (!p) return;
      var v = d.slice(i + 1).trim();
      BIND.lastIndex = 0;
      if (BIND.test(v)) dynamic = true;
      decls.push([camel(p), compileValue(v)]);
    });
    if (!dynamic) {
      var fixed = {};
      decls.forEach(function (d) { fixed[d[0]] = d[1](); });
      return function () { return fixed; };
    }
    return function (sc, vals) {
      var o = {};
      for (var i = 0; i < decls.length; i++) o[decls[i][0]] = strOf(decls[i][1](sc, vals));
      return o;
    };
  }

  // compileNode returns an ARRAY of fn(scope, vals) -> React node (text splits into parts).
  function compileNode(node, R) {
    if (node.nodeType === 3) { // text
      var text = node.nodeValue;
      BIND.lastIndex = 0;
      if (!BIND.test(text) && !text.trim()) return [];
      return toParts(text).map(function (p) {
        if (typeof p === 'string') return function (sc, vals) {
          return vals.__tr ? vals.__tr(p) : p;
        };
        return function (sc, vals) {
          var v = resolvePath(p.e, sc, vals);
          if (v == null) return null;
          return (typeof v === 'string' && vals.__tr) ? vals.__tr(v) : v;
        };
      });
    }
    if (node.nodeType !== 1) return []; // skip comments etc.

    var tag = node.tagName.toLowerCase();
    var childFns = compileChildren(node, R);

    if (tag === 'sc-if') {
      var cond = compileValue(node.getAttribute('value') || '');
      return [function (sc, vals) {
        if (!cond(sc, vals)) return null;
        return R.createElement.apply(R, [R.Fragment, null].concat(renderChildren(childFns, sc, vals)));
      }];
    }

    if (tag === 'sc-for') {
      var listFn = compileValue(node.getAttribute('list') || '');
      var name = node.getAttribute('as') || 'item';
      return [function (sc, vals) {
        var list = listFn(sc, vals) || [];
        return list.map(function (item, idx) {
          var child = Object.create(sc || null);
          child[name] = item;
          return R.createElement.apply(R, [R.Fragment, { key: idx }].concat(renderChildren(childFns, child, vals)));
        });
      }];
    }

    var realTag = TAG_MAP[tag] || tag;
    var staticProps = {};
    var dynProps = []; // [propName, fn]
    for (var i = 0; i < node.attributes.length; i++) {
      var at = node.attributes[i];
      var n = at.name;
      if (n.slice(0, 16) === 'hint-placeholder') continue;
      if (n === 'style') {
        dynProps.push(['style', compileStyle(at.value)]);
        continue;
      }
      var propName = EVENT_MAP[n] || (n === 'class' ? 'className' : n);
      if (propName === 'title') { // tooltips run through the translation map
        dynProps.push(['title', (function (f) {
          return function (sc, vals) {
            var v = f(sc, vals);
            return (typeof v === 'string' && vals.__tr) ? vals.__tr(v) : v;
          };
        })(compileValue(at.value))]);
        continue;
      }
      BIND.lastIndex = 0;
      if (BIND.test(at.value)) dynProps.push([propName, compileValue(at.value)]);
      else staticProps[propName] = at.value;
    }

    return [function (sc, vals) {
      var props = Object.assign({}, staticProps);
      for (var i = 0; i < dynProps.length; i++) props[dynProps[i][0]] = dynProps[i][1](sc, vals);
      return R.createElement.apply(R, [realTag, props].concat(renderChildren(childFns, sc, vals)));
    }];
  }

  function compileChildren(node, R) {
    var fns = [];
    for (var c = node.firstChild; c; c = c.nextSibling) {
      fns.push.apply(fns, compileNode(c, R));
    }
    return fns;
  }

  function renderChildren(fns, sc, vals) {
    var out = [];
    for (var i = 0; i < fns.length; i++) out.push(fns[i](sc, vals));
    return out;
  }

  var renderRoot = null; // fn(vals) -> React element, set in boot()

  function defineLogicBase() {
    window.DCLogic = class DCLogic extends window.React.Component {
      render() { return renderRoot ? renderRoot(this.renderVals()) : null; }
    };
  }

  function boot() {
    var R = window.React;
    var tpl = document.getElementById('dc-template').textContent
      .replace(/<select/g, '<dc-select').replace(/<\/select>/g, '</dc-select>')
      .replace(/<option/g, '<dc-option').replace(/<\/option>/g, '</dc-option>');
    var doc = new DOMParser().parseFromString(tpl, 'text/html');
    var rootFns = compileNode(doc.body.firstElementChild, R);
    renderRoot = function (vals) { return rootFns[0](null, vals); };
    window.ReactDOM.createRoot(document.getElementById('root'))
      .render(R.createElement(Component, PROPS));
  }

  defineLogicBase();
  // With <script defer>, readyState is already 'interactive' while scripts are still
  // executing in order; DOMContentLoaded is the earliest point where logic.js is loaded.
  if (document.readyState === 'complete') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
