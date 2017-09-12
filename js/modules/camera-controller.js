/**
 * Copyright 2014-2017 Krisztián Nagy
 * @file This file provides a class that builds on the Control module to provide a Controller for cameras of the SceneGraph module
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, localStorage, document, window, navigator */

/**
 * @param types Used for type-checking the configuration JSON for the camera controller
 * @param application Used for displaying error messages
 * @param control CameraController is a subclass of controller
 * @param camera Used to access the style enum of the Camera class
 */
define([
    "utils/types",
    "modules/application",
    "modules/control",
    "modules/scene/camera"
], function (types, application, control, camera) {
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
        /**
         * The relative velocity vector that is the result of acceleration induced by the user controlling the camera.
         * @type Number[3]
         */
        this._controlledVelocityVector = [0, 0, 0];
        /**
         * The target value for the controlled velocity vector currently set by user controls (it might take some time to reach this target
         * depending of the acceleration parameters of the camera). E.g. if when the user is moving the camera to the right, this will be
         * [max speed, 0, 0]
         * @type Number[3]
         */
        this._velocityTargetVector = [0, 0, 0];
        /**
         * The maximum speed the camera is allowed to move with along one axis by the user. (meters / second)
         * @type Number
         */
        this._maxSpeed = dataJSON.maxSpeed || 0;
        /**
         * The acceleration rate of the camera along one axis when controlled (moved) by the user. (m/s^2)
         * @type Number
         */
        this._acceleration = dataJSON.acceleration || 0;
        /**
         * The deceleration rate of the camera along one axis when controlled (stopped) by the user. (m/s^2)
         * @type Number
         */
        this._deceleration = dataJSON.deceleration || 0;
        /**
         * The current relative angular velocity of the camera, around axes: [X,Y,Z], in degrees / second
         * This is the result of angular acceleration induced by the player. (followed objects not considered)
         * @type Number[3]
         */
        this._angularVelocityVector = [0, 0, 0];
        /**
         * The maximum angular velocity around an axis when controlled by the user, degrees / second
         * @type Number
         */
        this._maxAngularVelocity = dataJSON.maxSpin || 0;
        /**
         * The angular acceleration of the camera along one axis when controlled (turned) by the user. (deg/s^2)
         * @type Number
         */
        this._angularAcceleration = dataJSON.angularAcceleration || 0;
        /**
         * The angular deceleration of the camera along one axis when controlled (stopped) by the user. (deg/s^2)
         * @type Number
         */
        this._angularDeceleration = dataJSON.angularDeceleration || 0;
        /**
         * The target value for the controlled angular velocity vector currently set by user controls (it might take some time to reach this 
         * target depending of the angular acceleration parameters of the camera). E.g. if when the user is turning the camera to the right, 
         * this will be [0, max.ang.acc., 0]
         * @type Number[3]
         */
        this._angularVelocityTargetVector = [0, 0, 0];
        /**
         * The duration of transitions that will occur when the camera is controlled to change the object(s) it is following. (in milliseconds)
         * @type Number
         */
        this._objectChangeTransitionDuration = dataJSON.objectChangeTransitionDuration;
        /**
         * The duration of transitions that will occur when the camera is controlled to change its current view of the same object. (in milliseconds)
         * @type Number
         */
        this._viewChangeTransitionDuration = dataJSON.viewChangeTransitionDuration;
        /**
         * The duration of transitions that will occur when the camera is controlled to reset its current view. (in milliseconds)
         * @type Number
         */
        this._viewResetTransitionDuration = dataJSON.viewResetTransitionDuration;
        /**
         * (enum Camera.TransitionStyle) The style of transitions applied by commands given to the camera by this controller.
         * @type String
         */
        this._transitionStyle = types.getEnumValue(camera.Camera.TransitionStyle, dataJSON.transitionStyle, {name: "cameraController.transitionStyle"});
        // The superclass constructor above loads the data from the JSON, so all action
        // properties should have been created.
        this.setActionFunctions("controlCamera", function () {
            if (this._context) {
                this._context.makeControllerPriority(this);
            } else {
                application.showError("Cannot make camera controller the priority controller because it is not added to any control context!");
            }
        }.bind(this), function () {
            if (this._controlledCamera.getConfiguration().resetsOnFocusChange()) {
                this._controlledCamera.transitionToConfigurationDefaults(this._viewResetTransitionDuration, this._transitionStyle);
            }
            if (this._context) {
                this._context.restoreDefaultControllerPriorityOrder();
            } else {
                application.showError("Cannot restore original priority order of the camera controller's context because it is not added to any!");
            }
        }.bind(this));
        // turning the camera in the six directions
        this.setActionFunctions("cameraTurnLeft", function (intensity) {
            if (intensity === undefined) {
                if (this._angularVelocityTargetVector[1] > -this._maxAngularVelocity) {
                    this._angularVelocityTargetVector[1] = -this._maxAngularVelocity;
                }
            } else {
                this._angularVelocityTargetVector[1] = -intensity;
                this._angularVelocityVector[1] = -intensity;
            }
        }.bind(this), function () {
            // stopping unnecessary left turn
            if (this._angularVelocityTargetVector[1] < 0) {
                this._angularVelocityTargetVector[1] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraTurnRight", function (intensity) {
            if (intensity === undefined) {
                if (this._angularVelocityTargetVector[1] < this._maxAngularVelocity) {
                    this._angularVelocityTargetVector[1] = this._maxAngularVelocity;
                }
            } else {
                this._angularVelocityTargetVector[1] = intensity;
                this._angularVelocityVector[1] = intensity;
            }
        }.bind(this), function () {
            // stopping unnecessary right turn
            if (this._angularVelocityTargetVector[1] > 0) {
                this._angularVelocityTargetVector[1] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraTurnUp", function (intensity) {
            if (intensity === undefined) {
                if (this._angularVelocityTargetVector[0] > -this._maxAngularVelocity) {
                    this._angularVelocityTargetVector[0] = -this._maxAngularVelocity;
                }
            } else {
                this._angularVelocityTargetVector[0] = -intensity;
                this._angularVelocityVector[0] = -intensity;
            }
        }.bind(this), function () {
            // stopping unnecessary upward turn
            if (this._angularVelocityTargetVector[0] < 0) {
                this._angularVelocityTargetVector[0] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraTurnDown", function (intensity) {
            if (intensity === undefined) {
                if (this._angularVelocityTargetVector[0] < this._maxAngularVelocity) {
                    this._angularVelocityTargetVector[0] = this._maxAngularVelocity;
                }
            } else {
                this._angularVelocityTargetVector[0] = intensity;
                this._angularVelocityVector[0] = intensity;
            }
        }.bind(this), function () {
            // stopping unnecessary downward turn
            if (this._angularVelocityTargetVector[0] > 0) {
                this._angularVelocityTargetVector[0] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraRollLeft", function (intensity) {
            if (intensity === undefined) {
                if (this._angularVelocityTargetVector[2] > -this._maxAngularVelocity) {
                    this._angularVelocityTargetVector[2] = -this._maxAngularVelocity;
                }
            } else {
                this._angularVelocityTargetVector[2] = -intensity;
                this._angularVelocityVector[2] = -intensity;
            }
        }.bind(this), function () {
            // stopping unnecessary left roll
            if (this._angularVelocityTargetVector[2] < 0) {
                this._angularVelocityTargetVector[2] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraRollRight", function (intensity) {
            if (intensity === undefined) {
                if (this._angularVelocityTargetVector[2] < this._maxAngularVelocity) {
                    this._angularVelocityTargetVector[2] = this._maxAngularVelocity;
                }
            } else {
                this._angularVelocityTargetVector[2] = intensity;
                this._angularVelocityVector[2] = intensity;
            }
        }.bind(this), function () {
            // stopping unnecessary right roll
            if (this._angularVelocityTargetVector[2] > 0) {
                this._angularVelocityTargetVector[2] = 0;
            }
        }.bind(this));
        //moving the camera along the 3 axes
        this.setActionFunctions("cameraMoveLeft", function () {
            if (this._velocityTargetVector[0] > -this._maxSpeed) {
                this._velocityTargetVector[0] = -this._maxSpeed;
            }
        }.bind(this), function () {
            // stopping unnecessary leftward movement
            if (this._velocityTargetVector[0] < 0) {
                this._velocityTargetVector[0] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraMoveRight", function () {
            if (this._velocityTargetVector[0] < this._maxSpeed) {
                this._velocityTargetVector[0] = this._maxSpeed;
            }
        }.bind(this), function () {
            // stopping unnecessary rightward movement
            if (this._velocityTargetVector[0] > 0) {
                this._velocityTargetVector[0] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraMoveUp", function () {
            if (this._velocityTargetVector[1] < this._maxSpeed) {
                this._velocityTargetVector[1] = this._maxSpeed;
            }
        }.bind(this), function () {
            // stopping unnecessary upward movement
            if (this._velocityTargetVector[1] > 0) {
                this._velocityTargetVector[1] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraMoveDown", function () {
            if (this._velocityTargetVector[1] > -this._maxSpeed) {
                this._velocityTargetVector[1] = -this._maxSpeed;
            }
        }.bind(this), function () {
            // stopping unnecessary downward movement
            if (this._velocityTargetVector[1] < 0) {
                this._velocityTargetVector[1] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraMoveForward", function (i) {
            var targetSpeed = ((i !== undefined) ? i : 1) * this._maxSpeed;
            if ((this._velocityTargetVector[2] > -targetSpeed) || (i !== undefined)) {
                this._velocityTargetVector[2] = -targetSpeed;
            }
        }.bind(this), function () {
            // stopping unnecessary forward movement
            if (this._velocityTargetVector[2] < 0) {
                this._velocityTargetVector[2] = 0;
            }
        }.bind(this));
        this.setActionFunctions("cameraMoveBackward", function () {
            if (this._velocityTargetVector[2] < this._maxSpeed) {
                this._velocityTargetVector[2] = this._maxSpeed;
            }
        }.bind(this), function () {
            // stopping unnecessary backward movement
            if (this._velocityTargetVector[2] > 0) {
                this._velocityTargetVector[2] = 0;
            }
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
            this._controlledCamera.changeToNextView(this._viewChangeTransitionDuration, this._transitionStyle);
        }.bind(this));
        this.setActionFunction("previousView", true, function () {
            this._controlledCamera.changeToPreviousView(this._viewChangeTransitionDuration, this._transitionStyle);
        }.bind(this));
        // following another object
        this.setActionFunction("followNext", true, function () {
            this._controlledCamera.followNextNode(true, this._objectChangeTransitionDuration, this._transitionStyle);
        }.bind(this));
        this.setActionFunction("followPrevious", true, function () {
            this._controlledCamera.followPreviousNode(true, this._objectChangeTransitionDuration, this._transitionStyle);
        }.bind(this));
        this.setActionFunction("resetView", true, function () {
            this._controlledCamera.transitionToConfigurationDefaults(this._viewResetTransitionDuration, this._transitionStyle);
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
     * Returns the maximum speed the camera is allowed to move with along one axis by the user. (meters / second)
     * @returns {Number}
     */
    CameraController.prototype.getMaxSpeed = function () {
        return this._maxSpeed;
    };
    /**
     * Sets the controlled camera to follow the passed visual object from now on.
     * @param {Object3D} renderableObject
     * @param {Number} [duration]
     * @param {String} [style] (enum Camera.TransitionStyle)
     */
    CameraController.prototype.setCameraToFollowObject = function (renderableObject, duration, style) {
        this._controlledCamera.followObject(renderableObject, false, duration, style);
    };
    /**
     * Sets the controlled camera to free control (not following any objects)
     */
    CameraController.prototype.setToFreeCamera = function () {
        this._controlledCamera.setToFreeCamera(false);
    };
    /**
     * Instantly stops camera movement and turning
     */
    CameraController.prototype.stop = function () {
        this._controlledVelocityVector[0] = 0;
        this._controlledVelocityVector[1] = 0;
        this._controlledVelocityVector[2] = 0;
        this._velocityTargetVector[0] = 0;
        this._velocityTargetVector[1] = 0;
        this._velocityTargetVector[2] = 0;
        this._angularVelocityVector[0] = 0;
        this._angularVelocityVector[1] = 0;
        this._angularVelocityVector[2] = 0;
        this._angularVelocityTargetVector[0] = 0;
        this._angularVelocityTargetVector[1] = 0;
        this._angularVelocityTargetVector[2] = 0;
    }
    /**
     * Calculates the angular velocity for this control step based on the control inputs that were issued in this step.
     * @param {Number} dt The time that has passed since the last control step (in milliseconds)
     */
    CameraController.prototype._updateAngularVelocity = function (dt) {
        var i;
        for (i = 0; i < this._angularVelocityVector.length; i++) {
            if (this._angularVelocityVector[i] >= 0) {
                if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] += this._angularAcceleration * dt / 1000;
                    if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                } else if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] -= this._angularDeceleration * dt / 1000;
                    if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                }
            } else if (this._angularVelocityVector[i] < 0) {
                if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] -= this._angularAcceleration * dt / 1000;
                    if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                } else if (this._angularVelocityVector[i] < this._angularVelocityTargetVector[i]) {
                    this._angularVelocityVector[i] += this._angularDeceleration * dt / 1000;
                    if (this._angularVelocityVector[i] > this._angularVelocityTargetVector[i]) {
                        this._angularVelocityVector[i] = this._angularVelocityTargetVector[i];
                    }
                }
            }
        }
    };
    /**
     * Calculates the velocity for this control step based on the control inputs that were issued in this step.
     * @param {Number} dt The time that has passed since the last control step (in milliseconds)
     */
    CameraController.prototype._updateVelocity = function (dt) {
        var i;
        for (i = 0; i < this._controlledVelocityVector.length; i++) {
            if (this._controlledVelocityVector[i] >= 0) {
                if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] += this._acceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                } else if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] -= this._deceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                }
            } else if (this._controlledVelocityVector[i] < 0) {
                if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] -= this._acceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                } else if (this._controlledVelocityVector[i] < this._velocityTargetVector[i]) {
                    this._controlledVelocityVector[i] += this._deceleration * dt / 1000;
                    if (this._controlledVelocityVector[i] > this._velocityTargetVector[i]) {
                        this._controlledVelocityVector[i] = this._velocityTargetVector[i];
                    }
                }
            }
        }
    };
    /**
     * Checks if there is a controlled camera set, and if there is one, executes the 
     * actions on the camera.
     * @param {Object[][]} triggeredActions See {@link Controller#executeActions}
     * @param {Number} dt The time elapsed since the last control step
     */
    CameraController.prototype.executeActions = function (triggeredActions, dt) {
        if (this._controlledCamera) {
            control.Controller.prototype.executeActions.call(this, triggeredActions);
            this._updateAngularVelocity(dt);
            this._updateVelocity(dt);
            this._controlledCamera.setControlledVelocityVector(this._controlledVelocityVector);
            this._controlledCamera.setAngularVelocityVector(this._angularVelocityVector);
        }
    };
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        CameraController: CameraController
    };
});
