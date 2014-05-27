define(['angular', './mine-listing'], function (angular, mines) {

  'use strict';

  var Services = angular.module('multimine-search-tool.services', []);

  Services.factory('queryParams', ['$window', function (window) {
    var queryString, result = {};
    if (queryString = window.location.search) {
      queryString.slice(1).split('&').forEach(function (pair) {
        var parts = pair.split('=')
          , key = parts[0]
          , value = window.unescape(parts[1]);
        if (result[key]) {
          if (result[key].push) {
            result[key].push(value);
          } else {
            result[key] = [result[key], value];
          }
        } else {
          result[key] = value;
        }
      });
    }
    return result;
  }]);

  // Service with same signature as the Mines service provided
  // by steps: {all: () -> Promise<Array<ServiceConfig>>}
  Services.factory('Mines', ['$q', function ($q) {

    var all = function () {
      return $q.when(mines);
    };

    return {all: all};
  }]);
});
