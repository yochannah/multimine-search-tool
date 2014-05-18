define([], function () {
  return ['$scope', '$timeout', RowController];

  function RowController(scope, to) {
    scope.fieldNames = {};
    
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
