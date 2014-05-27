/** Load sub modules, and get a reference to angular **/
define(['angular', 'underscore', './controllers', './services'], function (angular, _) {

	'use strict';
	
	var App = angular.module('multimine-search-tool', [
    'multimine-search-tool.controllers',
    'multimine-search-tool.services'
  ]);

  App.filter('mappingToArray', function() { return function(obj) {
    if (!(obj instanceof Object)) return obj;
    return _.map(obj, function(val, key) {
      return Object.defineProperty(val, '$key', {__proto__: null, value: key});
    });
  }});

  App.directive('blurOnClick', function () {
    return {
      restrict: 'A',
      link: function (scope, $element) {
        var el = $element[0];
        $element.on('click', el.blur.bind(el));
      }
    };
  });

});
