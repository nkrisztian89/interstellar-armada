/**
 * Copyright 2017 Krisztián Nagy
 * @file Event identifiers for spacecraft related events
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define */

define(function () {
    "use strict";
    /**
     * @typedef {Object} SpacecraftEvents~BeingTargetedData
     * @property {Spacecraft} spacecraft The spacecraft targeting this spacecraft
     */
    /**
     * @typedef {Object} SpacecraftEvents~BeingHitData
     * @property {Spacecraft} spacecraft The spacecraft that fired the projectile.
     * @property {Number[3]} hitPosition The position where the projectile has hit the spacecraft, in model-space.
     */
    /**
     * @typedef {Object} SpacecraftEvents~AnySpacecraftHitData
     * @property {Spacecraft} spacecraft The spacecraft that was hit.
     */
    /**
     * @typedef {Object} SpacecraftEvents~PreparingJumpData
     * @property {Number} timeLeft The amount of time left from the preparation, in milliseconds
     * @property {Number} duration The total duration of the preparation, in milliseconds
     */
    /**
     * @typedef {Object} SpacecraftEvents~JumpCommandData
     * @property {String} [way] 
     */
    /**
     * @typedef {Object} SpacecraftEvents~CommandData
     * @property {String} command The type of command to execute
     * @property {SpacecraftEvents~JumpCommandData} [jump] 
     */
    return {
        /** Another spacecraft targets the spacecraft. */
        BEING_TARGETED: "beingTargeted",
        /** A projectile hits the spacecraft. */
        BEING_HIT: "beingHit",
        /** A projectile fired by the spacecraft successfully hits its current target. */
        TARGET_HIT: "targetHit",
        /** A projectile fired by the spacecraft hits any spacecraft (including itself or its current target). */
        ANY_SPACECRAFT_HIT: "anySpacecraftHit",
        /** The current target of the spacecraft fires. */
        TARGET_FIRED: "targetFired",
        /** The spacecraft fires. */
        FIRED: "fired",
        /** The spacecraft is destructed (gets to the point in its explosion where the spacecraft should no longer be visible) */
        /** The handler of this event should return a boolean, determining whether the spacecraft object should be destroyed (true) or kept 
         * (false, in which case it can be respawned later - e.g. for the spacecraft preview in the editor)*/
        DESTRUCTED: "destructed",
        /** The spacecraft engages its jump engines. */
        JUMP_ENGAGED: "jumpEngaged",
        /** The spacecraft is preparing to jump out.  */
        PREPARING_JUMP: "preparingJump",
        /** The spacecraft is starting the outward jump. */
        JUMP_OUT_STARTED: "jumpOutStarted",
        /** The spacecraft has jumped out. */
        JUMPED_OUT: "jumpedOut",
        /** The spacecraft has jumped in. */
        JUMPED_IN: "jumpedIn",
        /** The spacecraft cancelled the jump process. */
        JUMP_CANCELLED: "jumpCancelled",
        /** The spacecraft received a command (to be handled by the AI) */
        COMMAND_RECEIVED: "commandReceived"
    };
});