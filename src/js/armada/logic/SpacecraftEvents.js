/**
 * Copyright 2017, 2020-2024 Krisztián Nagy
 * @file Event identifiers for spacecraft related events
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

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
     * @property {Number} hullDamage The amount of damage the hull suffered as a result of the hit (damage absorbed
     * by the shield and/or armor is not included)
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
     * @typedef {Object} SpacecraftEvents~JumpFormationData
     * @property {String} type What kind of formation is it (enum JumpCommandFormation defined in ai.js)
     * @property {Number[3]} spacing A vector based on which the offset position of ships in the formation can be calculated
     * Its exact meaning depends on the type of formation, but generally it influences the spacing distance / vector between neighbour ships
     */
    /**
     * @typedef {Object} SpacecraftEvents~JumpCommandData
     * @property {String} [way] Can be used to specify inward or outward jumps (if not given, the direction is chosen based on whether the
     * spacecraft is away or not)
     * @property {String} [anchor] ID of the spacecraft to use as an anchor for inward jumps. The position of the anchor spacecraft is added
     * to the position of the jumping spacecraft before inward jump.
     * @property {Boolean} [relative] When true, the position and orientation of the spacecraft should be interpreted relative to the anchor
     * (transformed by its orientation)
     * @property {Number[3]} [position] When given, overwrites the spacecraft's position before inward jump
     * @property {Array} [rotations] When given, overwrites the spacecraft's orientation before inward jump
     * @property {Number} [distance] When given, the spacecraft's position will be overridden by a new position generated randomly
     * to be this distance away from the anchor ship
     * @property {SpacecraftEvents~JumpFormationData} [formation] When given, the position and orientation is determined based on the 
     * formation data and the lead spacecraft of the command
     * @property {Spacecraft} [anchorSpacecraft] Set the first time the command is executed, so that further AIs executing the same command
     * will not have to query the anchor spacecraft
     * 
     */
    /**
     * @typedef {Object} SpacecraftEvents~TargetCommandData
     * @property {String} [single] The ID of the single spacecraft that should be targeted
     * @property {String[]} [list] The list of IDs of the spacecrafts that should be targeted and destroyed in this order
     * @property {String[]} [squads] The list of IDs of the squads the spacecrafts in which should be targeted and destroyed in this order
     * @property {Boolean} [priority] Whether the specified target(s) is/are priority targets
     * @property {Spacecraft} [targetSpacecrafts] Set the first time the command is executed, so that further AIs executing the same command
     * will not have to query the target spacecrafts
     */
    /**
     * @typedef {Object} SpacecraftEvents~ReachDistanceCommandData
     * @property {String} [target] The spacecraft from wich to calculate the distance
     * @property {Number} [minDistance] We need to get at least this far from the target
     * @property {Number} [maxDistance] We need to get at least this close to the target
     */
    /**
     * @typedef {Object} SpacecraftEvents~CommandData
     * @property {String} command The type of command to execute
     * @property {Spacecraft} [lead] The leading (first) spacecraft that received the same command (for example to apply a formation
     * relative to it) - set when the command is executed
     * @property {Number} [index] The index of the spacecraft that received the command among the spacecrafts that received it - set when 
     * the command is executed
     * @property {Boolean} [clearCache] When true, the cached properties in the command data should be cleared when executing the command
     * @property {SpacecraftEvents~JumpCommandData} [jump] Details of the command if it is a jump command
     * @property {SpacecraftEvents~TargetCommandData} [target] Details of the command if it is a target command
     * @property {SpacecraftEvents~ReachDistanceCommandData} [reachDistance] Details of the command if it is a reach distance command
     */
    /**
     * @typedef {Object} SpacecraftEvents~HUDData
     * @property {String} [section] (enum HUDSection - key in camelCase) The id of the section of the HUD to change. No value means the whole HUD
     * @property {String} state (enum HUDSectionState - key in camelCase) The state to change to
     */
    /**
     * @typedef {Object} SpacecraftEvents~RadioData
     * @property {Number} voice The index of the pilot voice to use (from the logic.battle.pilotVoices array in settings.json)
     * @property {Number} messageType The index of the generic radio message to use (from the logic.battle.voiceMessages array in settings.json)
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
        /** The spacecraft collides with another */
        COLLIDED: "collided",
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
        /** The spacecraft has finished the jump in sequence */
        ARRIVED: "arrived",
        /** The spacecraft cancelled the jump process. */
        JUMP_CANCELLED: "jumpCancelled",
        /** The spacecraft received a command (to be handled by the AI) */
        COMMAND_RECEIVED: "commandReceived",
        /** The HUD of the spacecraft should be updated */
        HUD: "hud",
        /** The spacecraft broadcasts a radio message */
        RADIO: "radio",
        /** The spacecraft gained a kill - it destroyed another spacecraft */
        GAIN_KILL: "gainKill"
    };
});