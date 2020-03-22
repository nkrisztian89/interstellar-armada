/**
 * Copyright 2014-2020 Krisztián Nagy
 * @file Provides some constants to be used in other game logic modules
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 2.0
 */

/*global define */

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
             * Lights sources for missiles will be added to their scenes with this priority
             * @type Number
             */
            MISSILE_LIGHT_PRIORITY = 3,
            /**
             * Lights sources for blinking lights on spacecrafts will be added to their scenes with this priority
             * @type Number
             */
            BLINKER_LIGHT_PRIORITY = 4,
            /**
             * Name of the pool for reusable Particle instances
             * @type String
             */
            PARTICLE_POOL_NAME = "Particle",
            /**
             * Name of the pool for reusable Projectile instances
             * @type String
             */
            PROJECTILE_POOL_NAME = "Projectile",
            /**
             * Name of the pool for reusable Missile instances
             * @type String
             */
            MISSILE_POOL_NAME = "Missile",
            /**
             * Name of the pool for reusable Explosion instances
             * @type String
             */
            EXPLOSION_POOL_NAME = "Explosion";
    // -------------------------------------------------------------------------
    // The public interface of the module
    return {
        SPACECRAFT_LIGHT_PRIORITY: SPACECRAFT_LIGHT_PRIORITY,
        EXPLOSION_LIGHT_PRIORITY: EXPLOSION_LIGHT_PRIORITY,
        PROJECTILE_LIGHT_PRIORITY: PROJECTILE_LIGHT_PRIORITY,
        MISSILE_LIGHT_PRIORITY: MISSILE_LIGHT_PRIORITY,
        BLINKER_LIGHT_PRIORITY: BLINKER_LIGHT_PRIORITY,
        PARTICLE_POOL_NAME: PARTICLE_POOL_NAME,
        PROJECTILE_POOL_NAME: PROJECTILE_POOL_NAME,
        MISSILE_POOL_NAME: MISSILE_POOL_NAME,
        EXPLOSION_POOL_NAME: EXPLOSION_POOL_NAME
    };
});