/**
 * Copyright 2016 Krisztián Nagy
 * @file Contains the constants accessible to all modules of the Interstellar Armada game.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*jslint white: true */
/*global define */

define(function () {
    "use strict";
    var
            GAME_NAME = "Interstellar Armada",
            LOCAL_STORAGE_PREFIX = "armada_",
            LANGUAGE_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "language",
            VERSION_LOCAL_STORAGE_ID = LOCAL_STORAGE_PREFIX + "version";
    // constants to be accessable for all game modules
    return {
        GAME_NAME: GAME_NAME,
        LOCAL_STORAGE_PREFIX: LOCAL_STORAGE_PREFIX,
        LANGUAGE_LOCAL_STORAGE_ID: LANGUAGE_LOCAL_STORAGE_ID,
        VERSION_LOCAL_STORAGE_ID: VERSION_LOCAL_STORAGE_ID
    };
});