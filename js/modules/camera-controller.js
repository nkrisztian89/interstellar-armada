/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file This file provides a class that builds on the Control module to provide a Controller for
 * cameras of the BudaScene module
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, localStorage, document, window, navigator */

/**
 * @param application Used for displaying error messages
 * @param control CameraController is a subclass of controller
 */
define([
    "modules/application",
    "modules/control"
], function (application, control) {
    "use strict";
    // #########################################################################
    /**
     * @class The camera controller pocesses and executes the actions with which
     * the user can control the camera
     * @extends Controller
     * @param {Object} dataJSON
     */
    function CameraController(dataJSON) {
        control.Controller.call(this, dataJSON);
        /**
         * A reference to the controlled camera object.
         * @type Camera
         */
        this._controlledCamera = null;
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created.
        this.setActionFunctions("controlCamera", function () {
            if (this._context) {
                this._context.makeControllerPriority(this);
            } else {
                application.showError("Cannot make camera controller the priority controller because it is not added to any control context!");
            }
        }.bind(this), function () {
            if (this._controlledCamera.getConfiguration().shouldAutoReset()) {
                this._controlledCamera.transitionToConfigurationDefaults();
            }
            if (this._context) {
                this._context.restoreDefaultControllerPriorityOrder();
            } else {
                application.showError("Cannot restore original priority order of the camera controller's context because it is not added to any!");
            }
        }.bind(this));
        // turning the camera in the four directions
        this.setActionFunctions("cameraTurnLeft", function (i) {
            this._controlledCamera.turnLeft(i);
        }.bind(this), function () {
            this._controlledCamera.stopLeftTurn();
        }.bind(this));
        this.setActionFunctions("cameraTurnRight", function (i) {
            this._controlledCamera.turnRight(i);
        }.bind(this), function () {
            this._controlledCamera.stopRightTurn();
        }.bind(this));
        this.setActionFunctions("cameraTurnUp", function (i) {
            this._controlledCamera.turnUp(i);
        }.bind(this), function () {
            this._controlledCamera.stopUpTurn();
        }.bind(this));
        this.setActionFunctions("cameraTurnDown", function (i) {
            this._controlledCamera.turnDown(i);
        }.bind(this), function () {
            this._controlledCamera.stopDownTurn();
        }.bind(this));
        this.setActionFunctions("cameraRollLeft", function (i) {
            this._controlledCamera.rollLeft(i);
        }.bind(this), function () {
            this._controlledCamera.stopLeftRoll();
        }.bind(this));
        this.setActionFunctions("cameraRollRight", function (i) {
            this._controlledCamera.rollRight(i);
        }.bind(this), function () {
            this._controlledCamera.stopRightRoll();
        }.bind(this));
        //moving the camera along the 3 axes
        this.setActionFunctions("cameraMoveLeft", function () {
            this._controlledCamera.moveLeft();
        }.bind(this), function () {
            this._controlledCamera.stopLeftMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveRight", function () {
            this._controlledCamera.moveRight();
        }.bind(this), function () {
            this._controlledCamera.stopRightMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveUp", function () {
            this._controlledCamera.moveUp();
        }.bind(this), function () {
            this._controlledCamera.stopUpMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveDown", function () {
            this._controlledCamera.moveDown();
        }.bind(this), function () {
            this._controlledCamera.stopDownMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveForward", function () {
            this._controlledCamera.moveForward();
        }.bind(this), function () {
            this._controlledCamera.stopForwardMove();
        }.bind(this));
        this.setActionFunctions("cameraMoveBackward", function () {
            this._controlledCamera.moveBackward();
        }.bind(this), function () {
            this._controlledCamera.stopBackwardMove();
        }.bind(this));
        // zooming
        this.setActionFunction("cameraDecreaseFOV", true, function () {
            this._controlledCamera.decreaseFOV();
        }.bind(this));
        this.setActionFunction("cameraIncreaseFOV", true, function () {
            this._controlledCamera.increaseFOV();
        }.bind(this));
        // changing the view
        this.setActionFunction("nextView", true, function () {
            this._controlledCamera.changeToNextView();
        }.bind(this));
        this.setActionFunction("previousView", true, function () {
            this._controlledCamera.changeToPreviousView();
        }.bind(this));
        // following another object
        this.setActionFunction("followNext", true, function () {
            this._controlledCamera.followNextNode(true);
        }.bind(this));
        this.setActionFunction("followPrevious", true, function () {
            this._controlledCamera.followPreviousNode(true);
        }.bind(this));
        this.setActionFunction("resetView", true, function () {
            this._controlledCamera.transitionToConfigurationDefaults();
        }.bind(this));
    }
    CameraController.prototype = new control.Controller();
    CameraController.prototype.constructor = CameraController;
    /**
     * Returns the string representation of the type (domain) of the controller.
     * This will be shown to users on the control settings page, which groups controls
     * based on domains.
     * @returns {String}
     */
    CameraController.prototype.getType = function () {
        return "camera";
    };
    /**
     * Sets the controlled camera for this controller. After called, all controls 
     * will take effect on the camera passed here as a parameter.
     * @param {Camera} controlledCamera
     */
    CameraController.prototype.setControlledCamera = function (controlledCamera) {
        this._controlledCamera = controlledCamera;
    };
    /**
     * Sets the controlled camera to follow the passed visual object from now on.
     * @param {Object3D} renderableObject
     */
    CameraController.prototype.setCameraToFollowObject = function (renderableObject) {
        this._controlledCamera.followObject(renderableObject, false);
    };
    /**
     * Sets the controlled camera to free control (not following any objects)
     */
    CameraController.prototype.setToFreeCamera = function () {
        this._controlledCamera.setToFreeCamera(false);
    };
    /**
     * Checks if there is a controlled camera set, and if there is one, executes the 
     * actions on the camera.
     * @param {Object[]} triggeredActions See {@link Controller#executeActions}
     */
    CameraController.prototype.executeActions = function (triggeredActions) {
        if (this._controlledCamera) {
            control.Controller.prototype.executeActions.call(this, triggeredActions);
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        CameraController: CameraController
    };
});
