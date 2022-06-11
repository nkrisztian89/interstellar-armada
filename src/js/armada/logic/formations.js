/**
 * Copyright 2022 Krisztián Nagy
 * @file Spacecraft formation related code
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */

/**
 * @param vec For calculating positions in a formation
 * @param application For error handling
 * @param config For getting default random seed
 */
define([
    "utils/vectors",
    "modules/application",
    "armada/configuration"
], function (vec, application, config) {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // enums
            /**
             * Spacecrafts can take one of these formations (e.g. for placing them initially in a mission or when jumping in)
             * @enum {String}
             */
            FormationType = {
                /** X offset is alternating (+/-), all offset factors increase for every second ship */
                WEDGE: "wedge",
                /** Each ship is offset by the given spacing from the previous one */
                LINE: "line",
                /** The offsets for the 3 ships after the lead: +X+Y+Z, -X+Y+Z, +2Y+2Z, then continues relative to the 4th */
                DIAMOND: "diamond",
                /** The position is randomly generated within the +/- X/2,Y/2,Z/2 around the lead position */
                RANDOM: "random"
            },
            // ------------------------------------------------------------------------------
            // private variables
            /**
             * A random function with a specific seed
             * @type Function
             */
            _random;
    // #########################################################################
    function resetRandomSeed() {
        _random = Math.seed(config.getSetting(config.GENERAL_SETTINGS.DEFAULT_RANDOM_SEED));
    }
    /**
     * Returns the relative position for a spacecraft in a formation
     * @param {SpacecraftEvents~JumpFormationData} formation The descriptor of the formation
     * @param {Number} index The index of the spacecraft within the formation (the lead is 0)
     * @param {Number[3]} [leadPosition] The 3D position vector of the lead ship in the formation
     * @param {Float32Array} [orientation] The 4x4 orientation matrix of the formation
     * @returns {Number[3]}
     */
    function getPositionInFormation(formation, index, leadPosition, orientation) {
        var result, factor, modulus;
        switch (formation.type) {
            case FormationType.WEDGE:
                factor = Math.ceil(index / 2);
                result = [
                    (((index % 2) === 1) ? 1 : -1) * factor * formation.spacing[0],
                    factor * formation.spacing[1],
                    factor * formation.spacing[2]];
                break;
            case FormationType.LINE:
                result = [
                    index * formation.spacing[0],
                    index * formation.spacing[1],
                    index * formation.spacing[2]];
                break;
            case FormationType.DIAMOND:
                modulus = (index % 3);
                factor = Math.floor(index / 3) * 2 + ((modulus > 0) ? 1 : 0);
                result = [
                    ((modulus === 0) ? 0 : (modulus === 1) ? 1 : -1) * formation.spacing[0],
                    factor * formation.spacing[1],
                    factor * formation.spacing[2]];
                break;
            case FormationType.RANDOM:
                result = [
                    _random() * formation.spacing[0] - formation.spacing[0] / 2,
                    _random() * formation.spacing[1] - formation.spacing[1] / 2,
                    _random() * formation.spacing[2] - formation.spacing[2] / 2
                ];
                break;
            default:
                application.showError("Unknown formation type specified: '" + formation.type + "!");
                return [0, 0, 0];
        }
        if (orientation) {
            vec.mulVec3Mat4(result, orientation);
        }
        if (leadPosition) {
            vec.add3(result, leadPosition);
        }
        return result;
    }
    config.executeWhenReady(function () {
        resetRandomSeed();
    });
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        FormationType: FormationType,
        resetRandomSeed: resetRandomSeed,
        getPositionInFormation: getPositionInFormation
    };
});