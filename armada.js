/**
 * @fileOverview This file is the main source file for the Armada project.
 * @author <a href="mailto:nkrisztian89@gmail.com">Krisztián Nagy</a>
 * @version 0.1
 */

/** 
 * Function to load additional JavaScript code from a list of source files.
 * Loads the scripts in the specified order, then executes a callback function.
 * @param {String[]} urls The list of JavaScript sourse files to load
 * @param {function} callback The function to call after loading the scripts
 */
function loadScripts(urls,callback) {
    // We add a new script tag inside the head of the document
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = urls.shift()+"?123";

    // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    if(urls.length>0) {
		script.onload = function() {loadScripts(urls,callback);};
		script.onreadystatechange = function() {loadScripts(urls,callback);};
	} else {
		script.onload = callback;
		script.onreadystatechange = callback;
	}

    // Fire the loading
    head.appendChild(script);
}

/** 
 * Entry point of the whole JavaScript program. Initiates loading the other
 * script files and the external resources.
 */
function start() {
	document.getElementById("status").innerHTML="loading program source...";
	loadScripts(["matrices.js","egom.js","graphics.js","physics.js","logic.js","grid.js","control.js"],loadResources);
}

// temporary test variable indicating the angle of directional lighting
var ang=0.7;
// temporary test variable indicating whether the direction of directional
// lighting should keep turning around
var lightTurn=true;

// test variable: number of random goals the AI controllers get at start
var num_test_goals=10;
// test variable: number of random fighters generated
var num_test_fighters=40;
// test variable: number of random ships generated
var num_test_ships=15;
// test variable: indicating the range within the random positions of fighters
// and ships and the destinations of their goals are generated
var mapSize=250;

/**
 * Main function loading the external resources required by the program. Builds
 * the test scene populated with random ships and fighters controlled by AI.
 * */
function loadResources() {
	var canvas = document.getElementById("canvas");
	var progress = document.getElementById("progress");

	var resourceCenter = new ResourceCenter();
	
	var mainScene = new Scene(0,0,canvas.width,canvas.height,true,[true,true,true,true],[0,0,0,1],true,new LODContext(4,[0,30,60,250,400]));
	//var pipScene = new Scene(canvas.width*2/3,canvas.height/4,canvas.width/3,canvas.height/2,false,[true,true,true,true],[0,0.5,0,0.5],true);
	
        // setting uniform valuables that are universal to all scene graph 
        // objects, so any shader used in the scene will be able to get their
        // values
	mainScene.uniformValueFunctions['u_lightDir'] = function() { return [-Math.cos(ang),Math.sin(ang),0.0]; };
	mainScene.uniformValueFunctions['u_cameraMatrix'] = function() { return mul(mainScene.activeCamera.positionMatrix,mainScene.activeCamera.orientationMatrix); };
	mainScene.uniformValueFunctions['u_projMatrix'] = function() { return mainScene.activeCamera.perspectiveMatrix; };
	mainScene.uniformValueFunctions['u_eyePos'] = function() 
		{
			var eyePos = [
				-mainScene.activeCamera.positionMatrix[12],
				-mainScene.activeCamera.positionMatrix[13],
				-mainScene.activeCamera.positionMatrix[14]
				];
			return [eyePos[0],eyePos[1],eyePos[2]]; 
		};
	
	resourceCenter.scenes.push(mainScene);
	//resourceCenter.scenes.push(pipScene);
        //pipScene.objects.push(new VisualObject(fregattModel,metalTexture,greenShader,0.0045,translationMatrix(0.0,0.0,-2.0),true));
	
	var test_level = new Level(resourceCenter,mainScene);
	
        // this loads the level and all needed other resources (models, shaders)
        // from the XML files
	test_level.loadFromFile("level.xml");
	
	progress.value=50;
	document.getElementById("status").innerHTML="loading additional configuration...";
	
        // we turn the cruizer around so it looks nicer at start :)
	test_level.spacecrafts[test_level.spacecrafts.length-1].physicalModel.orientationMatrix=
		mul(
			rotationMatrix4([0,1,0],3.1415/4),
			rotationMatrix4([0,0,1],3.1415/2)
			);
	
        // adding random fighters to the scene to test performance
	for(var i=0;i<num_test_fighters;i++) {
		test_level.spacecrafts.push(
			new Spacecraft(
				new GraphicsContext(resourceCenter,mainScene),
				new LogicContext(test_level),
				test_level.getSpacecraftClass("fecske"),
				test_level.getPlayer("human"),
				translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2),
				"ai"
				)
			);
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("plasma"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("plasma"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addPropulsion(resourceCenter,test_level.getPropulsionClass("fighter"));
	}
	
        // adding random ships to the scene to test performance
	for(var i=0;i<num_test_ships;i++) {
		test_level.spacecrafts.push(
			new Spacecraft(
				new GraphicsContext(resourceCenter,mainScene),
				new LogicContext(test_level),
				test_level.getSpacecraftClass("fregatt"),
				test_level.getPlayer("human"),
				translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2),
				"ai"
				)
			);
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("cannon"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addWeapon(resourceCenter,test_level.getWeaponClass("cannon"));
		test_level.spacecrafts[test_level.spacecrafts.length-1].addPropulsion(resourceCenter,test_level.getPropulsionClass("frigate"));
	}
        
        // adding a sphere model for testing the shading
        /*var sphereModel = new EgomModel();
        sphereModel.addSphere(0,0,0,5,32,[1.0,1.0,1.0,1.0],0,20,[[0,0],[0,0.5],[0.5,0.5]],false);
        sphereModel.filename="sphere";
        mainScene.objects.push(new Mesh([new ModelWithLOD(resourceCenter.addModel(sphereModel,"sphere"),0)],resourceCenter.getShader("simple"),resourceCenter.getTexture("textures/fem.bmp"),identityMatrix4(),identityMatrix4(),identityMatrix4(),false));
        mainScene.objects[mainScene.objects.length-1].orientationMatrix=
                mul(
                    rotationMatrix4([1,0,0],3.1415/4),
                    rotationMatrix4([0,1,0],3.1415/4)
                );*/
        
        mainScene.cameras.push(new Camera(canvas.width/canvas.height,90,true,true));
	
        // adding random goals to the AI for testing
	for(var i=0;i<test_level.spacecrafts.length;i++) {
		for(var j=0;j<num_test_goals;j++) {
			test_level.spacecrafts[i].controller.goals.push(new Goal(translationMatrix(Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2,Math.random()*mapSize-mapSize/2)));
		}
	}
	/*
        // setting up the position and direction of the main camera
	mainScene.activeCamera.positionMatrix=
		mul(
			mainScene.activeCamera.positionMatrix,
			translationMatrix(0,10,-10)
		);
		
	mainScene.activeCamera.orientationMatrix=
		mul(
			mainScene.activeCamera.orientationMatrix,
			rotationMatrix4([1,0,0],3.1415/4)
		);*/
	
	var freq = 60;
	
	progress.value=75;
	
	resourceCenter.init(canvas,freq);
	
	document.onkeydown = handleKeyDown;
        document.onkeyup = handleKeyUp;
        document.onkeypress = handleKeyPress;
	
	setInterval(function()
		{
			test_level.tick(1000/freq);
			control(resourceCenter,mainScene,test_level);
			ang+=lightTurn?0.07:0.0;
		},1000/freq);
}
