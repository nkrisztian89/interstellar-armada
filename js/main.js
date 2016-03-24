/**
 * Copyright 2014-2016 Krisztián Nagy
 * @file The entry point for the Interstellar Armada application, to be invoked by RequireJS.
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 * @version 1.0
 */

/*global require */
/**
 * @param armada
 */
require(["armada/armada"], function (armada) {
    "use strict";
    armada.initialize();
});
