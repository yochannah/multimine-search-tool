define([], function () {
  'use strict';

  return ['$scope', '$timeout', '$q', RowController];

  function RowController(scope, to, Q) {
    scope.fieldNames = {};

    // Fetch summary values when needed.
    scope.$watch('result.selected', function (isSelected) {
      if (!scope.result || isSelected || scope.result.summaryValues) return;

      scope.result.summaryValues = []; // Prevent double fetch.
      scope.result.mine.fetchSummaryFields().then(function (typeToFields) {
        var result = scope.result;
        var type = result.type;
        var fields = typeToFields[type];
        var toFetch = [];
        var promises = fields.map(function (path, i) {
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
        if (toFetch.length) { // Fetch any values we don't already have.
          var q = {
            select: toFetch.map(function (tf) { return tf.path; }),
            where: {id: result.id}
          };
          result.mine.rows(q).then(function (rows) {
            var values = rows[0];
            values.forEach(function (value, i) {
              toFetch[i].def.resolve({path: toFetch[i].path, value: value});
            });
          });
        }
        Q.all(promises).then(function (summaryValues) {
          to(function () { result.summaryValues = summaryValues; });
        });
      });
    });
    
    scope.$watch(fieldNameWatcher, function () {
      Object.keys(scope.result.fields).forEach(function (field) {
        if (!scope.fieldNames[field]) {
          scope.result.mine.fetchModel().then(function(model) {
            var path = model.makePath(scope.result.type + '.' + field);
            path.getDisplayName().then(function(name) {
              // the replace below is quite fragile. Not a good idea?
              to(function () {scope.fieldNames[field] = name.replace(/^[^>]* >/, '');});
            });
          });
        }
      });
    });
  }

  function fieldNameWatcher (scope) {
    return Object.keys(scope.result.fields).join(',');
  }
});
