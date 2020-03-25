/**
 * Copyright 2016-2018, 2020 Krisztián Nagy
 * @file Grunt configuration file for the Interstellar Armada game
 * @author Krisztián Nagy [nkrisztian89@gmail.com]
 * @licence GNU GPLv3 <http://www.gnu.org/licenses/>
 */
/*jslint white: true*/
/*global module*/
/**
 * @param grunt
 */
module.exports = function (grunt) {
    "use strict";
    var
            scssMappings = {
                "css/general.css": 'src/scss/general.scss',
                "css/about.css": 'src/scss/screens/about.scss',
                "css/battle.css": 'src/scss/screens/battle.scss',
                "css/controls.css": 'src/scss/screens/controls.scss',
                "css/database.css": 'src/scss/screens/database.scss',
                "css/debriefing.css": 'src/scss/screens/debriefing.scss',
                "css/gameplay-settings.css": 'src/scss/screens/gameplay-settings.scss',
                "css/graphics.css": 'src/scss/screens/graphics.scss',
                "css/ingame-menu.css": 'src/scss/screens/ingame-menu.scss',
                "css/missions.css": 'src/scss/screens/missions.scss',
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
            getterReplacements = [
                ["positionMatrix"],
                ["orientationMatrix"],
                ["scalingMatrix"],
                ["scene"],
                ["renderableObject"],
                ["subnodes"],
                ["minimumCountForInstancing"],
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
                ["defaultEquipmentProfileName"],
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
                ["weapons"],
                ["physicalPositionMatrix", "get", "physicalModel._positionMatrix"],
                ["physicalOrientationMatrix", "get", "physicalModel._orientationMatrix"],
                ["physicalScalingMatrix", "get", "physicalModel._scalingMatrix"],
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
                ["isRenderedWithDepthMask", ""]
            ].map(function (replacement) {
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
    });
    // flatten the getterReplacements array
    getterReplacements.reduce(function (acc, val) {
        return acc.concat(val);
    }, []);
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        _requirejs: {
            compile: {
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
            }
        },
        _clean: {
            full: ["config/", "css/", "data/", "js/"],
            editor: ["js/editor", "js/editor*"],
            dist: ["js/*", "!js/main.js"]
        },
        _copy: {
            data: {
                files: [
                    {expand: true, cwd: 'src/config/', src: ['**'], dest: 'config/'},
                    {expand: true, cwd: 'src/data/', src: ['**'], dest: 'data/'}
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
                configFile: ".eslintrc.js"
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
            preOptimize: {
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
                            match: 'egomModel.resetDebugStats();',
                            replacement: '//egomModel.resetDebugStats();'
                        }
                    ],
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**'], dest: 'js/'}
                ]
            },
            // replacing some widely and frequently used one-line getter calls with the direct access of their respective properties to
            // avoid the overhead of calling the getter functions
            optimize: {
                options: {
                    patterns: getterReplacements.concat([
                        {
                            match: '_scene.getLODContext()',
                            replacement: '_scene._lodContext'
                        }, {
                            match: '.getDefaultGroupLuminosityFactors()',
                            replacement: '._defaultLuminosityFactors'
                        }, {
                            match: 'setFileCacheBypassEnabled(true)',
                            replacement: 'setFileCacheBypassEnabled(false)'
                        }
                    ]),
                    usePrefix: false
                },
                files: [
                    {expand: true, cwd: 'js/', src: ['**'], dest: 'js/'}
                ]
            },
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
            dev: [['_sass:dev', '_replace:sass'], '_copy:data', '_copy:js'],
            build: ['_sass:dist', ['_copy:data', '_minify:config', '_minify:data'], ['_copy:js', '_clean:editor', '_replace:preOptimize', '_replace:optimize', '_requirejs', '_clean:dist', '_replace:postOptimize']]
        }
    });
    // Plugins
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-requirejs');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-replace');
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
    grunt.registerTask('clean', ['_clean:full']);
    grunt.registerTask('lint', ['_eslint']);
    grunt.registerTask('dev-build', ['_concurrent:dev']);
    grunt.registerTask('css-build', ['_sass:dist']);
    grunt.registerTask('watch', ['_concurrent:watch']);
};