/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file Provides some constants to be used in other game logic modules
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*jslint nomen: true, white: true, plusplus: true */
/*global define, Element, this, Float32Array, performance */

define(function () {
    "use strict";
    var
            // ------------------------------------------------------------------------------
            // constants
            /**
             * Static lights anchored to spacecrafts will be added to their scenes with this priority
             * @type Number
             */
            SPACECRAFT_LIGHT_PRIORITY = 0,
            /**
             * Lights sources for explosions will be added to their scenes with this priority
             * @type Number
             */
            EXPLOSION_LIGHT_PRIORITY = 1,
            /**
             * Lights sources for projectiles will be added to their scenes with this priority
             * @type Number
             */
            PROJECTILE_LIGHT_PRIORITY = 2,
            /**
             * Lights sources for blinking lights on spacecrafts will be added to their scenes with this priority
             * @type Number
             */
            BLINKER_LIGHT_PRIORITY = 3;
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        SPACECRAFT_LIGHT_PRIORITY: SPACECRAFT_LIGHT_PRIORITY,
        EXPLOSION_LIGHT_PRIORITY: EXPLOSION_LIGHT_PRIORITY,
        PROJECTILE_LIGHT_PRIORITY: PROJECTILE_LIGHT_PRIORITY,
        BLINKER_LIGHT_PRIORITY: BLINKER_LIGHT_PRIORITY
    };
});