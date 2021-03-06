/// <reference path="../../typings/tsd.d.ts" />
/// <reference path="./models.ts" />

module app.controllers {
    'use strict';
    class GameModelBuilder implements IModelBuilder<IGameModel> {

        static $inject = ['$log', 'apiService', '$state'];
        constructor(
            private $log: ng.ILogService,
            private apiService: IApiService,
            private $state: ng.ui.IStateService
        ) {}

        getModel = (id: string):ng.IPromise<IGameModel> => {
            this.$log.debug('PlayModelBuilder:getModel getting game', id);
            return this.apiService.api.getGame({id: id}).$promise
                .then((game: IGameModel) => {
                    this.$log.debug('PlayModelBuilder:getModel received model', game);
                    return game;
                })
                .catch(() => {
                    // If game not found, return home
                    this.$state.go('home');
                });
        };
    }

    class HomeController {

        static $inject = ['$log', '$state', '$scope', 'apiService'];
        constructor(
            private $log: ng.ILogService,
            private $state: ng.ui.IStateService,
            private $scope: ng.IScope,
            private apiService: IApiService
        ) {
            // Intentionally set time out for 1s in order show the pacman loading screen
            setTimeout(() => {
                this.createGame()
            }, 1000);
        }

        private createGame = () => {
             // create a new game , redirect to 'play'
            this.apiService.api.createGame().$promise
                .then((game: IGameModel) => {
                    this.$log.debug('HomeController: createGame', game);
                    this.$log.debug('HomeController: game id', game.id);
                    this.$state.go('play', {game_id: game.id})
                });
        }
    }

    class PlayController implements IPlayController{
        private pollingId: number;
        model: IGameModel;
        static $inject = ['$log', '$state', '$scope', 'apiService', 'game'];
        constructor(
            private $log: ng.ILogService,
            private $state: any,
            private $scope: IPlayScope,
            private apiService: IApiService,
            private game: IGameModel
        ) {
            $scope.vm = this;

            //Assign initial game model
            this.model = game;
            this.model.used_flag = this.countUsedFlag(this.model.board);
            if (!game.game_status) {
                this.pollingId = this.startPolling();
            }
        }

        clickHandler = (cell:ICell, action: string) => {
            if (cell.revealed || cell.state || this.model.game_status) {
                return;
            }
            var updateRequest: IUpdateRequest = {
                method: action,
                x: cell.x,
                y: cell.y
            };
            this.$log.debug('PlayController:clickHandler ', updateRequest);
            this.apiService.api
                .updateGame(
                    {
                        id: this.$state.params.game_id
                    },
                    updateRequest
                ).$promise
                .then((game: IGameModel) => {
                    //update game
                    this.$log.debug('PlayController:clickHandler received game', game);
                    this.model = game;
                    this.model.used_flag = this.countUsedFlag(this.model.board);
                    if (game.game_status) {
                        this.stopPolling();
                    }
                });
        };

        newGame = ():void => {
            this.$log.debug('PlayController:newGame starting a new game');
            this.$state.go('home');
        };

        private startPolling = ():number => {
            this.$log.debug('PlayController:startPolling long poling begins');
            return setInterval(() => {
                 this.apiService.api.getGame({id: this.$state.params.game_id}).$promise
                    .then((game: IGameModel) => {
                        this.model = game;
                        this.model.used_flag = this.countUsedFlag(this.model.board);
                    });
            }, 500);
        };

        private stopPolling = () => {
            this.$log.debug('PlayController:startPolling long poling ends');
            clearInterval(this.pollingId);
        };

        private countUsedFlag = (board: ICell[][]):number => {
            return _.chain(board)
                .map((row) => {
                    return _.filter(row, (cell):boolean => {
                        return cell.marked;
                    });
                })
                .reduce((result, array) => {
                    return result.concat(array);
                }, [])
                .value()
                .length;
        };
    }

    angular.module('app')
        .controller('homeController', HomeController)
        .controller('playController', PlayController)
        .service('gameModelBuilder', GameModelBuilder);
}