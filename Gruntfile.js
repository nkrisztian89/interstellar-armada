/**
 * Copyright 2016-2018, 2020-2022 Krisztián Nagy
 * @file Grunt configuration file for the Interstellar Armada game
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */
/**
 * @param grunt
 */
module.exports = function (grunt) {
    "use strict";
    var
            settings = grunt.file.readJSON("src/config/settings.json"),
            getConstName = function (string) {
                var result = "", i;
                for (i = 0; i < string.length; i++) {
                    if (string[i].match(/[A-Z]/)) {
                        result += "_";
                    }
                    result += ((string[i] === " ") || (string[i] === "-")) ? "_" : string[i].toUpperCase();
                }
                return result;
            },
            scssMappings = {
                "css/general.css": 'src/scss/general.scss',
                "css/about.css": 'src/scss/screens/about.scss',
                "css/battle.css": 'src/scss/screens/battle.scss',
                "css/controls.css": 'src/scss/screens/controls.scss',
                "css/database.css": 'src/scss/screens/database.scss',
                "css/debriefing.css": 'src/scss/screens/debriefing.scss',
                "css/gameplay-settings.css": 'src/scss/screens/gameplay-settings.scss',
                "css/general-settings.css": 'src/scss/screens/general-settings.scss',
                "css/graphics.css": 'src/scss/screens/graphics.scss',
                "css/ingame-menu.css": 'src/scss/screens/ingame-menu.scss',
                "css/missions.css": 'src/scss/screens/missions.scss',
                "css/multi-games.css": 'src/scss/screens/multi-games.scss',
                "css/multi-lobby.css": 'src/scss/screens/multi-lobby.scss',
                "css/multi-score.css": 'src/scss/screens/multi-score.scss',
                "css/checkgroup.css": 'src/scss/components/checkgroup.scss',
                "css/dialog.css": 'src/scss/components/dialog.scss',
                "css/infobox.css": 'src/scss/components/infobox.scss',
                "css/listcomponent.css": 'src/scss/components/listcomponent.scss',
                "css/loadingbox.css": 'src/scss/components/loadingbox.scss',
                "css/selector.css": 'src/scss/components/selector.scss',
                "css/slider.css": 'src/scss/components/slider.scss',
                "css/editor.css": 'src/scss/editor.scss'
            },
            // the getters for the properties with these names simply return the "private" property of the object,
            // which is useful for development (as functions crash if there is a typo in the name instead of just
            // silently returning undefined, and they provide another hooking point for debug code), but for
            // optimization purposes, it is better to refer to the property directly in the release builds, so
            // here we build an array of replacements which replace the getters with direct property access and
            // remove their definitions from the code
            // these getters are to be replaced both in the game and the editor sources
            gettersToReplaceCommon = [
                ["positionMatrix"],
                ["orientationMatrix"],
                ["scalingMatrix"],
                ["velocityMatrix"],
                ["renderableObject"],
                ["subnodes"],
                ["instancing"],
                ["rootNode"],
                ["camera"],
                ["duration"],
                ["visualModel"],
                ["physicalModel"],
                ["childrenAlwaysInside", ""],
                ["ignoreTransform", "should"],
                ["color"],
                ["lightColor"],
                ["layers"],
                ["growthRate"],
                ["dimensions"],
                ["directionSpread"],
                ["velocity"],
                ["velocitySpread"],
                ["initialNumber"],
                ["spawnNumber"],
                ["spawnTime"],
                ["delay"],
                ["particleEmitterDescriptors"],
                ["mass"],
                ["muzzleFlash"],
                ["lightIntensity"],
                ["trailDescriptor"],
                ["explosionClass"],
                ["shieldExplosionClass"],
                ["shortName"],
                ["antiShip", "is"],
                ["lockingAngle"],
                ["modelScale"],
                ["capacity"],
                ["length"],
                ["homingMode"],
                ["angularAcceleration"],
                ["mainBurnAngleThreshold"],
                ["launchVelocity"],
                ["ignitionTime"],
                ["salvoCooldown"],
                ["proximityRange"],
                ["kineticFactor"],
                ["thrusterSlots"],
                ["barrels"],
                ["attachmentPoint"],
                ["rotationStyle"],
                ["fixed", "is"],
                ["basePoint"],
                ["rotators"],
                ["thrusterBurnParticle"],
                ["prepareVelocity"],
                ["prepareDuration"],
                ["jumpOutDuration"],
                ["jumpOutAcceleration"],
                ["jumpOutScaling"],
                ["jumpOutExplosionClass"],
                ["jumpInDuration"],
                ["jumpInDeceleration"],
                ["jumpInVelocity"],
                ["jumpInScaling"],
                ["jumpInExplosionClass"],
                ["rechargeColor"],
                ["rechargeAnimationDuration"],
                ["isFighterType", ""],
                ["name"],
                ["particle"],
                ["position"],
                ["period"],
                ["intensity"],
                ["spacecraftType"],
                ["hitpoints"],
                ["armor"],
                ["factionColor"],
                ["turnStyle"],
                ["attackVectorAngles"],
                ["attackThresholdAngle"],
                ["bodies"],
                ["weaponSlots"],
                ["missileLaunchers"],
                ["defaultLoadout"],
                ["views"],
                ["showTimeRatioDuringExplosion"],
                ["damageIndicators"],
                ["lightSources"],
                ["blinkerDescriptors"],
                ["missileClass", "get", "class"],
                ["salvoLeft"],
                ["state"],
                ["squads"],
                ["trigger"],
                ["pilotedSpacecraft", "get", "pilotedCraft"],
                ["squad"],
                ["indexInSquad"],
                ["weapons"],
                ["physicalPositionMatrix", "get", "physicalModel._positionMatrix"],
                ["physicalOrientationMatrix", "get", "physicalModel._orientationMatrix"],
                ["physicalScalingMatrix", "get", "physicalModel._scalingMatrix"],
                ["physicalVelocityMatrix", "get", "physicalModel._velocityMatrix"],
                ["missileClasses"],
                ["targetingSpacecrafts", "get", "targetedBy"],
                ["propulsion"],
                ["scale"],
                ["scaleMode"],
                ["visibleSize"],
                ["velocityVector"],
                ["boxLayout"],
                ["element"],
                ["emitting", "is"],
                ["isFighterType", ""],
                ["isAimingView", ""],
                ["inSalvoMode", "is", "salvo"],
                ["locked", "is"],
                ["alive", "is"],
                ["away", "is"],
                ["readyToUse", "is"],
                ["playing", "is"],
                ["measuredFromCenter", "is"],
                ["mousePosition"],
                ["isRenderedWithoutDepthMask", ""],
                ["isRenderedWithDepthMask", ""],
                ["dissipationDuration"],
                ["wireframe", "is"],
                ["test", "is"],
                ["custom", "is"],
                ["dragFactor"],
                ["angularDrag"],
                ["vibrationEnabled", "is"],
                ["hitDistance"],
                ["points"],
                ["playerHitpointsFactor"],
                ["friendlyHitpointsFactor"],
                ["enemyReactionTimeFactor"],
                ["playerSelfDamage"],
                ["playerFriendlyFireDamage"],
                ["hitboxOffset"],
                ["lastStrafeTarget"],
                ["lastLiftTarget"],
                ["lastYawTarget"],
                ["lastPitchTarget"],
                ["lastRollTarget"],
                ["initialCount"],
                ["team"],
                ["key"],
                ["minLOD"],
                ["aspect"],
                ["minFOV"],
                ["maxFOV"],
                ["node"],
                ["origoPositionMatrix"]
            ],
            // these getters are to be replaced only in the game (and not the editor) sources
            gettersToReplaceGame = [
                ["scene"]
            ],
            getGetterReplacement = function (replacement) {
                // create the replacements for each simple getter
                var
                        functionName = ((replacement.length > 1) ? replacement[1] : "get") + ((replacement[1] === "") ? replacement[0] : replacement[0][0].toUpperCase() + replacement[0].substring(1)),
                        fieldName = "_" + ((replacement.length > 2) ? replacement[2] : replacement[0]);
                return [{
                        // replace calls to this getter with a simple reference to the property
                        match: "." + functionName + '()',
                        replacement: "." + fieldName
                    }, {
                        // remove the getter definition from the prototype
                        match: new RegExp("\\s\\w+\\.prototype\\." + functionName + " = function \\(\\) {\\s+return this." + fieldName + ";\\s+};", "g"),
                        replacement: ""
                    }, {
                        // remove the getter definition from the prototype if it was added by reference
                        match: new RegExp("\\s\\w+\\.prototype\\." + functionName + " = \\w+;", "g"),
                        replacement: ""
                    }];
            },
            getterReplacementsCommon = gettersToReplaceCommon.map(getGetterReplacement),
            getterReplacementsGame = gettersToReplaceGame.map(getGetterReplacement),
            setterReplacements = [
                ["lightSource"],
                ["strafeTarget"],
                ["liftTarget"],
                ["yawTarget"],
                ["pitchTarget"],
                ["rollTarget"],
                ["team"],
                ["controlledCamera"],
                ["name"],
                ["dragFactor"],
                ["node"],
                ["instancedShader"],
                ["smallestSizeWhenDrawn"],
                ["clearColor"],
                ["ambientColor"],
                ["revealState"]
            ].map(
            function (replacement) {
// create the replacements for each simple setter
                var
                        functionName = ((replacement.length > 1) ? replacement[1] : "set") + ((replacement[1] === "") ? replacement[0] : replacement[0][0].toUpperCase() + replacement[0].substring(1)),
                        fieldName = "_" + ((replacement.length > 2) ? replacement[2] : replacement[0]);
                return [{
                        // replace calls to this setter with a simple assignment of the property
                        match: new RegExp("\\." + functionName + "\\(((?:[^()]+|\\((?:[^()]+|\\([^()]*\\))*\\))*)\\)", "g"),
                        replacement: "." + fieldName + "=" + "$1"
                    }, {
                        // remove the setter definition from the prototype
                        match: new RegExp("\\s\\w+\\.prototype\\." + functionName + " = function \\(\\w+\\) {\\s+this." + fieldName + " = \\w+;\\s+};", "g"),
                        replacement: ""
                    }, {
                        // remove the setter definition from the prototype if it was added by reference
                        match: new RegExp("\\s\\w+\\.prototype\\." + functionName + " = \\w+;", "g"),
                        replacement: ""
                    }];
            }),
            methodRemovals = [
                "showHitbox",
                "hideHitbox",
                "toggleHitboxVisibility",
                "getHitboxTextures",
                "_addHitboxModel",
                "getHitbox",
                "addCuboid",
                "log",
                "logNodes",
                ["increaseCount", false, "Scene"],
                "setupShadowMapDebugging",
                "getMainDebugStats",
                "getShadowMapDebugStats",
                ["isShadowMapDebuggingEnabled", true],
                ["getShadowMapDebuggingSettings", true],
                "getNumLines",
                "getNumTriangles",
                // -------------------------------------------------------------
                // stereoscopy
                "setAnaglyphRendering",
                "setSideBySideRendering",
                ["isAnaglyphRenderingEnabled", true],
                ["getAnaglyphRenderingSettings", true],
                ["isSideBySideRenderingEnabled", true],
                ["getSideBySideRenderingSettings", true]
            ].map(
            function (replacement) {
                var functionName = Array.isArray(replacement) ? replacement[0] : replacement, exported = Array.isArray(replacement) && replacement[1], className = Array.isArray(replacement) && replacement[2],
                        result = [{
                                // remove the method definition from the prototype (up to 2 levels of curly braces nesting in function body)
                                match: new RegExp("\\s" + (className || "\\w+") + "\\.prototype\\." + functionName + " = function \\((\\w+,*\\s*)*\\) {(?:[^}{]+|{(?:[^}{]+|{[^}{]*})*})*};", "g"),
                                replacement: ""
                            }];
                if (exported) {
                    result.push({
                        // remove the method export
                        match: new RegExp(functionName + ": _context\\." + functionName + "\\.bind\\(_context\\),*", "g"),
                        replacement: ""
                    });
                }
                return result;
            }),
            exportedFunctionRemovals = [
                ["isDebugVersion", null, true],
                ["resetDebugStats", "egomModel"],
                ["getDebugStats", "egomModel"],
                ["getDebugInfo"],
                ["cuboidModel", null, true]
            ].map(
            function (replacement) {
                var functionName = replacement[0], moduleName = (replacement.length > 1) ? replacement[1] : null, direct = (replacement.length > 2) ? replacement[2] : false,
                        result = direct ? [{
                                // remove the function definition and export (up to 2 levels of curly braces nesting in function body)
                                match: new RegExp(functionName + ": function \\((\\w+,*\\s*)*\\) {(?:[^}{]+|{(?:[^}{]+|{[^}{]*})*})*},*", "g"),
                                replacement: ""
                            }] :
                        [{
                                // remove the function definition (up to 2 levels of curly braces nesting in function body)
                                match: new RegExp("function " + functionName + "\\((\\w+,*\\s*)*\\) {(?:[^}{]+|{(?:[^}{]+|{[^}{]*})*})*}", "g"),
                                replacement: ""
                            }, {
                                // remove the function export
                                match: new RegExp(functionName + ": " + functionName + ",*", "g"),
                                replacement: ""
                            }];
                if (moduleName) {
                    result.push({
                        // remove the function calls (matching alphanumeric params)
                        match: new RegExp(moduleName + "\\." + functionName + "\\((\\w+,*\\s*)*\\);", "g"),
                        replacement: ""
                    });
                }
                return result;
            }),
            objectRemovals = [
                "_DEBUG_STATS"
            ].map(
            function (objectName) {
                return {
                    // remove the object definition (up to 2 levels of curly braces nesting)
                    match: new RegExp(objectName + " = {(?:[^}{]+|{(?:[^}{]+|{[^}{]*})*})*}(,|;)*", "g"),
                    replacement: ""
                };
            }),
            fieldRemovals = [
                "_nodeCount",
                "_nodeCountByType",
                "_mainDebugStats",
                "_shadowMapDebugStats",
                "_shadowMapDebugging",
                "_shadowMapDebugLightIndex",
                "_shadowMapDebugRangeIndex",
                "_shadowMapDebugShader",
                // -------------------------------------------------------------
                // stereoscopy
                "_stereoscopicMode",
                "_redShader",
                "_cyanShader",
                "_stereoscopicFrameBuffer",
                "_leftShader",
                "_rightShader",
                "_sideBySideOriginalAspect"
            ].map(
            function (fieldName) {
                return {
                    // remove field setter
                    match: new RegExp("this\\." + fieldName + " = [\\w\\.]+;", "g"),
                    replacement: ""
                };
            }),
            settingsToReplace = [
                ["missileAutoChangeCooldown", "battle"],
                ["cameraPilotingSwitchTransitionDuration", "battle"],
                ["cameraPilotingSwitchTransitionStyle", "battle"],
                ["strafeSpeedFactor", "battle"],
                ["turnAccelerationDurationInSeconds", "battle", "TURN_ACCELERATION_DURATION_S"],
                ["backgroundObjectDistance", "battle"],
                ["defaultMuzzleFlashDuration", "battle"],
                ["targetViewName", "battle"],
                ["targetChangeTransitionDuration", "battle"],
                ["targetChangeTransitionStyle", "battle"],
                ["targetOrderDuration", "battle"],
                ["selfFire", "battle"],
                ["maxCombatForwardSpeedFactor", "battle"],
                ["maxCombatReverseSpeedFactor", "battle"],
                ["maxCruiseForwardSpeedFactor", "battle"],
                ["maxCruiseReverseSpeedFactor", "battle"],
                ["showHitboxesForHitchecks", "battle"],
                ["fireSoundStackingTimeThreshold", "battle"],
                ["fireSoundStackingVolumeFactor", "battle"],
                ["hitSoundStackingTimeThreshold", "battle"],
                ["hitSoundStackingVolumeFactor", "battle"],
                ["weaponFireSoundStackMinimumDistance", "battle"],
                ["demoFighterAI", "battle", "DEMO_FIGHTER_AI_TYPE"],
                ["demoShipAI", "battle", "DEMO_SHIP_AI_TYPE"],
                ["scoreFractionForKill", "battle"],
                ["scoreBonusForHullIntegrity", "battle"],
                ["scoreBonusForHullIntegrityTeam", "battle"],
                ["missileHitRatioFactor", "battle"],
                ["scoreBonusForTeamSurvival", "battle"],
                ["particlePoolPrefillFactor", "battle"],
                ["projectilePoolPrefillFactor", "battle"],
                ["missilePoolPrefillFactor", "battle"],
                ["trailSegmentPoolPrefillFactor", "battle"],
                ["explosionPoolPrefillFactor", "battle"],
                ["viewDistance", "battle"],
                ["moveToOrigoDistance", "battle"],
                ["demoViewSwitchInterval", "battle"],
                ["demoDoubleViewSwitchChance", "battle"],
                ["jumpPrepareViewName", "battle"],
                ["jumpOutViewName", "battle"],
                ["musicVolumeInMenus", "battle"],
                ["sfxVolumeInMenus", "battle"],
                ["simulationStepsPerSecond", "battle"],
                ["battleRenderFPS", "battle", "RENDER_FPS"],
                ["quitDelayAfterJumpOut", "battle"],
                ["gameStateDisplayDelay", "battle"],
                ["multiMatchQuitDelay", "battle"],
                ["endThemeCrossfadeDuration", "battle"],
                ["cameraDefaultTransitionDuration", "battle"],
                ["cameraDefaultTransitionStyle", "battle"],
                ["ambientMusic", "battle"],
                ["victoryMusic", "battle"],
                ["defeatMusic", "battle"],
                ["debriefingVictoryMusic", "battle"],
                ["debriefingDefeatMusic", "battle"],
                ["combatThemeDurationAfterFire", "battle"],
                ["debriefingThemeFadeInDuration", "battle"],
                ["useRequestAnimFrame", "general"],
                ["defaultRandomSeed", "general"],
                ["luminosityFactorsArrayName", "general", "UNIFORM_LUMINOSITY_FACTORS_ARRAY_NAME"],
                ["useVerticalCameraValues", "general"],
                ["menuMusic", "general"],
                ["musicFadeInDuration", "general"],
                ["themeCrossfadeDuration", "general"],
                ["musicFadeOutDuration", "general"],
                ["slowConnectionThreshold", "multi"],
                ["connectionLostThreshold", "multi"],
                ["disconnectThreshold", "multi"]
            ],
            settingConfigReplacements = settingsToReplace.map(
                    function (replacement) {
                        var value = settings.logic[replacement[1]][replacement[0]],
                                setting = '"' + replacement[0] + '": ' + ((typeof value === "string") ? '"' + value + '"' : value);
                        return {
                            // either remove a comma from before or after the setting (if there is any)
                            match: new RegExp(",\\s*" + setting + "|" + setting + ",*", "g"),
                            replacement: ""
                        };
                    }),
            settingReplacements = settingsToReplace.map(
                    function (replacement) {
                        var constName = (replacement.length < 3) ? getConstName(replacement[0]) : replacement[2],
                                value = settings.logic[replacement[1]][replacement[0]];
                        return [{
                                // replacing usages of this setting
                                match: "config.getSetting(config." + replacement[1].toUpperCase() + "_SETTINGS." + constName + ")",
                                replacement: (typeof value === "string") ? '"' + value + '"' : value
                            }, {
                                // removing the definition of this setting from configuration.js
                                match: new RegExp("\\s" + constName + ": {\\s*name: \"" + replacement[0] + "\"(?:[^}{]+|{(?:[^}{]+|{[^}{]*})*})*}[,\\s]", "g"),
                                replacement: ""
                            }];
                    });
    // flatten the replacements arrays
    getterReplacementsCommon.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    getterReplacementsGame.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    setterReplacements.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    methodRemovals.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    exportedFunctionRemovals.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    settingReplacements.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        _requirejs: {
            game: {
                options: {
                    baseUrl: "js",
                    name: "main",
                    optimize: "uglify2",
                    uglify2: {
                        mangle: {
                            keep_fnames: false // turn on to keep minification but make error messages using constructor.name readable
                        }
                    },
                    out: "js/main.js",
                    preserveLicenseComments: false
                }
            },
            editor: {
                options: {
                    baseUrl: "js",
                    name: "editor-main",
                    optimize: "none",
                    out: "js/editor-main.js",
                    preserveLicenseComments: false
                }
            }
        },
        _clean: {
            full: ["config/", "css/", "data/", "js/", "dist/"],
            editor: ["js/editor", "js/editor*"],
            dist: ["js/*", "!js/main.js"],
            distWithEditor: ["js/*", "!js/main.js", "!js/editor-main.js"],
            snap: ["dist/"]
        },
        _copy: {
            devData: {
                files: [
                    {expand: true, cwd: 'src/config/', src: ['**'], dest: 'config/'},
                    {expand: true, cwd: 'src/data/', src: ['**'], dest: 'data/'}
                ]
            },
            distData: {
                files: [
                    {expand: true, cwd: 'src/config/', src: ['**'], dest: 'config/'},
                    {expand: true, cwd: 'src/data/', src: ['**', '!test/**', '!missions/tests/**', 'missions/tests/test.json'], dest: 'data/'}
                ]
            },
            js: {
                files: [
                    {expand: true, cwd: 'src/js/', src: ['**'], dest: 'js/'}
                ]
            }
        },
        _sync: {
            dev: {
                files: [
                    {expand: true, cwd: 'src/config/', src: ['**'], dest: 'config/'},
                    {expand: true, cwd: 'src/data/', src: ['**'], dest: 'data/'},
                    {expand: true, cwd: 'src/js/', src: ['**'], dest: 'js/'}
                ]
            }
        },
        _eslint: {
            options: {
                overrideConfigFile: ".eslintrc.js"
            },
            target: ["src/js/"]
        },
        _sass: {
            dev: {
                options: {
                    style: "expanded"
                },
                files: scssMappings
            },
            dist: {
                options: {
                    noSourceMap: true,
                    style: "compressed"
                },
                files: scssMappings
            }
        },
        _minify: {
            config: {
                files: 'config/**/*.json'
            },
            data: {
                files: 'data/**/*.json'
            }
        },
        _replace: {
            distConfig: {
                // removes setting values that have been baked into the game source
                options: {
                    patterns: settingConfigReplacements,
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'config/', src: ['settings.json'], dest: 'config/'}
                ]
            },
            distData: {
                // removes test mission entries from missions.json
                options: {
                    patterns: [
                        {
                            match: /,\s*{\s*"source":\s*"[^"]*",\s*"test":\s*true\s*}/g,
                            replacement: ''
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'data/', src: ['missions.json'], dest: 'data/'}
                ]
            },
            // these replacements should be applied to both the game and the editor
            preOptimizeCommon: {
                options: {
                    patterns: [
                        {
                            match: '_matrixCount++;',
                            replacement: '//_matrixCount++;'
                        }, {
                            match: 'application.log_DEBUG',
                            replacement: '//application.log_DEBUG'
                        }, {
                            match: '_DEBUG_STATS.',
                            replacement: '//_DEBUG_STATS.'
                        }, {
                            match: '|| application.crash()',
                            replacement: ''
                        }, {
                            match: 'application.crash();',
                            replacement: ''
                        }, {
                            match: 'application.isDebugVersion()',
                            replacement: 'false'
                        }, {
                            match: 'missionDescriptor.isTest()',
                            replacement: 'false'
                        }, {
                            match: 'if (this._shadowMapDebugging) {',
                            replacement: 'if (false) {'
                        }, {
                            match: 'graphics.isShadowMapDebuggingEnabled()',
                            replacement: 'false'
                                    // -------------------------------------------------
                                    // stereoscopy
                        }, {
                            match: 'graphics.isAnaglyphRenderingEnabled()',
                            replacement: 'false'
                        }, {
                            match: 'graphics.isSideBySideRenderingEnabled()',
                            replacement: 'false'
                        }, {
                            match: 'if (this._stereoscopicMode !== Scene.StereoscopicMode.NONE) {',
                            replacement: 'if (false) {'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**'], dest: 'js/'}
                ]
            },
            // these replacements should only be applied to the game, and not the editor (removes hitbox visuals for example)
            preOptimizeGame: {
                options: {
                    patterns: [
                        {
                            match: 'if (preview) {',
                            replacement: 'if (false) {'
                        }, {
                            match: 'if (!preview) {',
                            replacement: 'if (true) {'
                        }, {
                            match: 'preview ? ',
                            replacement: 'false ? '
                        }, {
                            match: '_hitZoneColor =',
                            replacement: '//'
                        }, {
                            match: '_hitZoneColor,',
                            replacement: '//'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**', '!editor', '!editor*'], dest: 'js/'}
                ]
            },
            // replacing some widely and frequently used one-line getter calls with the direct access of their respective properties to
            // avoid the overhead of calling the getter functions
            // these replacements should be applied to both the game and the editor
            optimizeCommon: {
                options: {
                    patterns: getterReplacementsCommon.concat(setterReplacements.concat(settingReplacements.concat([
                        {
                            match: '_scene.getLODContext()',
                            replacement: '_scene._lodContext'
                        }, {
                            match: '.getDefaultGroupLuminosityFactors()',
                            replacement: '._defaultLuminosityFactors'
                        }, {
                            match: 'setFileCacheBypassEnabled(true)',
                            replacement: 'setFileCacheBypassEnabled(false)'
                        }, {
                            match: 'if (_showHitboxesForHitchecks) {',
                            replacement: 'if (false) {'
                        }, {
                            match: '!silentDiscard',
                            replacement: 'false'
                        }
                    ]))),
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**'], dest: 'js/'}
                ]
            },
            // these replacements should only be applied to the game, and not the editor (removes hitbox visuals for example)
            optimizeGame: {
                options: {
                    patterns: getterReplacementsGame.concat(methodRemovals.concat(exportedFunctionRemovals.concat(objectRemovals.concat(fieldRemovals.concat([
                        {
                            match: 'addSupplements.hitboxes',
                            replacement: 'false'
                        }, {
                            match: 'this._hitbox = null',
                            replacement: '//'
                        }, {
                            match: 'if (this._hitbox) {',
                            replacement: 'if (false) {'
                        }, {
                            match: 'if (hitbox) {',
                            replacement: 'if (false) {'
                        }
                    ]))))),
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**', '!editor', '!editor*'], dest: 'js/'}
                ]
            },
            // these replacements should be applied to both the game and the editor
            postOptimize: {
                options: {
                    // shorten some commonly used long property/method names to make the build file smaller
                    patterns: [
                        {
                            match: '_positionMatrixInCameraSpaceValid',
                            replacement: 'pMCV'
                        }, {
                            match: '_positionMatrixInCameraSpace',
                            replacement: 'pMC'
                        }, {
                            match: '_positionMatrix',
                            replacement: 'pM'
                        }, {
                            match: '_orientationMatrix',
                            replacement: 'oM'
                        }, {
                            match: '_scalingMatrix',
                            replacement: 'sM'
                        }, {
                            match: '_cascadeScalingMatrix',
                            replacement: 'csM'
                        }, {
                            match: '_modelMatrixInverseValid',
                            replacement: 'mMIV'
                        }, {
                            match: '_modelMatrixInverse',
                            replacement: 'mMI'
                        }, {
                            match: '_modelMatrix',
                            replacement: 'mM'
                        }, {
                            match: '_visualModel',
                            replacement: 'vMo'
                        }, {
                            match: '_physicalModel',
                            replacement: 'pMo'
                        }, {
                            match: '_spacecraft',
                            replacement: '_sc'
                        }, {
                            match: '_weapon',
                            replacement: '_w'
                        }, {
                            match: '_projectile',
                            replacement: '_p'
                        }, {
                            match: '_missileLauncher',
                            replacement: '_mL'
                        }, {
                            match: '_missile',
                            replacement: '_m'
                        }, {
                            match: '_targetingComputer',
                            replacement: '_tC'
                        }, {
                            match: '_target',
                            replacement: '_t'
                        }, {
                            match: '_maneuveringComputer',
                            replacement: '_mC'
                        }, {
                            match: 'BATTLE_SETTINGS',
                            replacement: 'BS'
                        }, {
                            match: 'getHUDSetting',
                            replacement: 'gHS'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**'], dest: 'js/'}
                ]
            },
            sass: {
                options: {
                    patterns: [
                        {
                            match: 'sourceMappingURL=css/',
                            replacement: 'sourceMappingURL='
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, flatten: true, src: ['css/*.css'], dest: './css'}
                ]
            }
        },
        _watch: {
            dev: {
                files: ['src/config/**', 'src/data/**', 'src/js/**'],
                tasks: ['_sync:dev'],
                options: {
                    spawn: true
                }
            },
            sass: {
                files: ['src/scss/**'],
                tasks: ['_sass:dev', '_replace:sass'],
                options: {
                    spawn: true
                }
            }
        },
        _concurrent: {
            watch: ['_watch:dev', '_watch:sass'],
            dev: [['_sass:dev', '_replace:sass'], '_copy:devData', '_copy:js'],
            build: ['_sass:dist', ['_copy:distData', '_replace:distConfig', '_replace:distData', '_minify:config', '_minify:data'], ['_copy:js', '_clean:editor', '_replace:preOptimizeCommon', '_replace:preOptimizeGame', '_replace:optimizeCommon', '_replace:optimizeGame', '_requirejs:game', '_clean:dist', '_replace:postOptimize']],
            buildWithEditor: ['_sass:dist', ['_copy:distData', '_replace:distConfig', '_replace:distData', '_minify:config', '_minify:data'], ['_copy:js', '_replace:preOptimizeCommon', '_replace:optimizeCommon', '_requirejs:editor', '_replace:preOptimizeGame', '_replace:optimizeGame', '_requirejs:game', '_clean:distWithEditor', '_replace:postOptimize']]
        }
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-replace-lts');
    grunt.loadNpmTasks('grunt-eslint');
    grunt.loadNpmTasks('grunt-json-minify');
    grunt.loadNpmTasks('grunt-sync');
    grunt.loadNpmTasks('grunt-concurrent');
    // "Private" tasks (meant only to be used to construct the pulbic tasks, not to be run directly)
    grunt.renameTask('copy', '_copy');
    grunt.renameTask('clean', '_clean');
    grunt.renameTask('eslint', '_eslint');
    grunt.renameTask('replace', '_replace');
    grunt.renameTask('sass', '_sass');
    grunt.renameTask('requirejs', '_requirejs');
    grunt.renameTask('json-minify', '_minify');
    grunt.renameTask('sync', '_sync');
    grunt.renameTask('watch', '_watch');
    grunt.renameTask('concurrent', '_concurrent');
    // "Public" tasks (meant to be run directly)
    grunt.registerTask('default', ['build']);
    grunt.registerTask('build', ['_concurrent:build']);
    grunt.registerTask('build-with-editor', ['_concurrent:buildWithEditor']);
    grunt.registerTask('clean', ['_clean:full']);
    grunt.registerTask('clean-snap', ['_clean:snap']);
    grunt.registerTask('lint', ['_eslint']);
    grunt.registerTask('dev-build', ['_concurrent:dev']);
    grunt.registerTask('watch', ['_concurrent:watch']);
};