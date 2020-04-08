/**
 * Copyright 2014-2017, 2020 Krisztián Nagy
 * @file The entry point for the Interstellar Armada application, to be invoked by RequireJS.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global requirejs */
/**
 * @param armada
 */
requirejs(["armada/armada"], function (armada) {
    "use strict";
    armada.initialize({electron: location.hash.indexOf("electron") >= 0});
});
