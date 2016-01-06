define(['angular', 'underscore', './controllers/search-results'], function(angular, _, SearchResultsCtrl) {

  'use strict';
  var i = 0;
  var Controllers = angular.module('multimine-search-tool.controllers', [])
    .controller('DemoCtrl', DemoCtrl)
    .controller('FacetCtrl', FacetCtrl)
    .controller('HeadingCtrl', HeadingCtrl)
    .controller('MessagesCtrl', MessagesCtrl)
    .controller('SearchResultsCtrl', SearchResultsCtrl)
    .controller('SearchInputCtrl', SearchInputCtrl);

  // Currently does nothing.
  function SearchInputCtrl(scope, location) {
    scope.$watch('step.data.searchTerm', function(term) {
      scope.searchterm = term;
      this.data = (scope.step && scope.step.data);
    });
    this.location = location;
  }
  SearchInputCtrl.$inject = ['$scope', '$location'];
  SearchInputCtrl.prototype.searchFor = function(term) {
    this.location.search('q', term);
  };

  function HeadingCtrl(scope) {
    var self = this;
    scope.$watch('state.results', function(results) {
      self.results = results;
    });
  }
  HeadingCtrl.$inject = ['$scope'];

  function FacetCtrl() {}
  FacetCtrl.prototype.facetCount = function(facetGroup) {
    return Object.keys(facetGroup).length;
  };

  function MessagesCtrl() {
    this.collapsed = true;
  }

  // The demo controller.
  function DemoCtrl(scope, timeout, location, queryParams) {

    scope.step = {
      data: {
        searchTerm: (queryParams.q || queryParams.stepsTerm || 'lola')
      }
    };
    scope.messages = {
      ids: {}
    };
    scope.wantedMsgs = {
      ids: {}
    };

    scope.sumAvailable = scope.sumSelected = 0;

    scope.$watch('messages', function() {
      var sum = 0;
      _.values(scope.messages.ids).forEach(function(data) {
        sum += data.ids.length;
      });
      scope.sumAvailable = sum;
    });

    scope.$on('$locationChangeSuccess', function() {
      var queryParamLocation = location.search().q;
      //Reload after a search if this is the demo page.
      //If it's embedded in steps we don't use /URL query param nav, and this
      //would trigger a blank digest cycle if left outside a conditional, breaking the world.
      if (!window.searchTerm) {
        scope.step.data.searchTerm = queryParamLocation;
      }
    });

    scope.$on('has', function(event, message) {

      // these lines are for debugging. We're triggering several hundred 'has'es
      // per page load at the moment. Crazay.
      // It's probably because of this: http://stackoverflow.com/questions/24825930/angular-scope-watch-with-an-function-that-returns-a-promise
      ////////////////////////////////////////////////////////////
      //Begin debug:
      // i++;
      // console.log("%cmessage","color:lightseagreen;font-weight:bold;",message, i);
      // console.log("%cevent","color:darkseagreen;font-weight:bold;",event, i);

      if(message.data) {
        //is this the tool or the demo?
        if (chan) {
          //notify jschannel
          reportItems(message.data);
        } else {
          //update the message window
          updateMessageWindow(message);

        }
      }
    });

    function updateMessageWindow(message) {
      if (message.data) {
        scope.messages[message.what][message.key] = message.data;
      } else {
        delete scope.messages[message.what][message.key];
      }
      timeout(function() { // need a new reference to trigger update.
        scope.messages = _.extend({}, scope.messages);
      });
    }
  }
  DemoCtrl.$inject = ['$scope', '$timeout', '$location', 'queryParams'];

});
