define(function (require, exports, module) {

  'use strict';

  exports.controller = ['$scope', '$q', RowController];

  // Aggressively cache display names, by type and by field.
  // the data structure used will end up as a multimap, keyed as
  // map[serviceBaseUrl][path] = string
  var fieldNames = {};
  var typeNames = {};

  function RowController(scope, Q) {
    var self = this;

    // Make sure mine is available to self.
    scope.$watch('result.mine', function (mine) {
      self.mine = mine;
    });
    scope.$watch('result.type', function (type) {
      self.type = type;
    });

    // Fetch summary values when needed.
    scope.$watch('result.selected', function (isSelected) {
      if (!scope.result || isSelected || scope.result.summaryValues) return;

      scope.result.summaryValues = []; // Prevent double fetch.
      var mine = scope.result.mine;
      var result = scope.result;

      mine.fetchSummaryFields().then(function (typeToFields) {
        var type = result.type;
        var fields = typeToFields[type];
        var toFetch = [];
        // pendingFields :: Array<Promise<{path, value}>>
        var pendingFields = fields.map(function (path, i) {
          var asField = path.slice(path.indexOf('.') + 1);
          var def;
          if (asField in result.fields) { // We have it - use it.
            return Q.when({path: path, value: result.fields[asField]});
          } else { // We don't have it - make a note and move on.
            def = Q.defer();
            toFetch.push({def: def, path: path});
            return def.promise;
          }
        });
        Q.all(pendingFields).then(function (summaryValues) {
          result.summaryValues = summaryValues;
        });

        if (toFetch.length) { // Fetch any values we don't already have.
          var q = {
            select: toFetch.map(function (tf) { return tf.path; }),
            where: {id: result.id}
          };
          mine.rows(q).then(function (rows) {
            var values = rows[0]; // Can only be one result (id constraint).
            values.forEach(function (value, i) {
              toFetch[i].def.resolve({path: toFetch[i].path, value: value});
            });
          });
        }
      });
    });

    scope.$watch('scope.result.type', function () {
      if (!(scope.result && scope.result.mine)) return;

      var mine = scope.result.mine;
      var key = "TN:" + mine.root + ":" + scope.result.type;
      Q.when(promiseUniquely(key, fetchTypeName)).then(function (name) {
        self.setTypeName(scope.result, name);
      });

      function fetchTypeName () {
        return fetchDisplayName(mine, scope.result.type);
      }
    });
    
    scope.$watch(fieldNameWatcher, function () {
      if (!(scope.result && scope.result.mine)) return;

      var mine = scope.result.mine;

      Object.keys(scope.result.fields).forEach(function (field) {
        var path = scope.result.type + '.' + field;
        var key = 'FN:' + mine.root + ':' + path;
        Q.when(promiseUniquely(key, fetchFieldName(path))).then(function (name) {
          self.setFieldName(path, name);
        }).catch(function (err) {
          console.error(err);
        });
      });

      function fetchFieldName (path) {
        return function () {
          return fetchDisplayName(mine, path).then(function (name) {
            return name.replace(/^[^>]* >/, '');
          });
        };
      }

    });
  }

  RowController.prototype.getFieldName = function getFieldName (field) {
    if (!this.mine || !this.type || !field) return null;
    var path = this.type + '.' + field;
    return fieldNames[this.mine.root] && fieldNames[this.mine.root][path];
  };

  RowController.prototype.setFieldName = function setFieldName (path, name) {
    if (!this.mine) return null;
    if (!fieldNames[this.mine.root]) {
      fieldNames[this.mine.root] = {};
    }
    return fieldNames[this.mine.root][path] = name;
  };

  RowController.prototype.setTypeName = function setTypeName (result, name) {
    if (!this.mine) return null;
    if (!typeNames[this.mine.root]) {
      typeNames[this.mine.root] = {};
    }
    return typeNames[this.mine.root][result.type] = name;
  }

  RowController.prototype.getTypeName = function getTypeName (result) {
    if (!this.mine || !result) return null;
    return typeNames[this.mine.root] && typeNames[this.mine.root][result.type];
  }

  // Helper for making sure we don't make IO requests for data we already
  // have. This can be removed completely once all mines support the
  // correct cache headers on model requests (flymine already does, the
  // others not so much).
  var promises = {};
  function promiseUniquely (key, action) {
    if (!promises[key]) {
      try {
        promises[key] = action();
      } catch (e) {
        console.error(e);
      }
    } 
    return promises[key];
  }

  function fetchDisplayName(mine, path) {
    return mine.fetchModel().then(function (model) {
      return model.makePath(path).getDisplayName();
    });
  }

  function fieldNameWatcher (scope) {
    if (!scope.result && scope.result.fields) return null;
    return Object.keys(scope.result.fields).join(',');
  }

});
