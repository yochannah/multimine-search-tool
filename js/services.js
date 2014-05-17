define(['angular', './mine-listing'], function (angular, mines) {

  'use strict';

  var Services = angular.module('multimine-search-tool.services', []);

  // Service with same signature as the Mines service provided
  // by steps: {all: () -> Promise<Array<ServiceConfig>>}
  Services.factory('Mines', ['$q', function ($q) {

    var all = function () {
      return $q.when(mines);
    };

    return {all: all};
  }]);
});
