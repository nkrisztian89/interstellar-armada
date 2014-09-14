INTRO
=====

This is the readme file for the Interstellar Armada (working name) program.
With any questions, turn to the author Krisztián Nagy <nkrisztian89@gmail.com>.

Interstellar Armada is JavaScript application currently in the early development 
phase.

It is a game set in a space environment far in the future.
As of the moment, the player can control one spaceship and fly around, as well 
as fire the ship's weapons.

LAUNCHING THE APP
=================

To start:
*   Click on the __Download ZIP__ button on the right and save the zip file.
*   Extract the contents of the zip.
*   Double click on index.html among the extracted files.

Notes:
*   Check the keyboard commands and the instructions below before you start, as 
    right now the UI is under development, and you will not get many hints about
    what to do.
*   The application will load a lot of data (mostly geometry for models),
    therefore it can take quite a while (15-30 seconds or even more) before you 
    see the "ready" message - this might look like your browser is frozen, but 
    most probably it is not, just be patient.
*   I'm developing the game testing it in the newest _Firefox_, therefore for
    best results, open the index.html in Firefox. (although it should work just
    fine in Chrome and other modern browsers as well)
*   The memory usage is quite high at the moment, which can make Firefox freeze
    if you reopen the page several times. If you wish to start again, I
    recommend closing the browser and reopening it.

RECOMMENDATIONS FOR TRYING IT OUT
=================================

After the program loads, use the `arrow keys` and `page up/down` to move around 
the camera. Press `ctrl` and the `arrow keys` to turn around.

Once you've taken a look, press `C` to get the camera follow a spacecraft. You 
can press C multiple times to cycle through the spaceships and then eventually
get back to free camera controls. Pressing `X` will bring you back to the 
previous ship.

To inspect a ship a bit more, press `V` multiple times while the camera is fixed 
on it. This will bring you to the different camera views available for that 
ship, some of which allow you to turn around, again using `ctrl` and the `arrow 
keys`.

When you've found your favourite spacecraft, press `M` to assume manual control 
of it. Now you can turn the ship around using its thrusters by pressing the 
`arrow keys` and  `page up/down`. You can fire the ship's weapons by pressing 
`space`.

To move around, you have two options.
The game uses realistic (simplified, newtonian) physics, which means since we're 
in space, nothing will stop your craft if it starts moving in one direction.
You can experience this fully in the default _"free" flight mode_. Pressing `W` 
will fire your rear thrusters and pressing `S` will fire your forward thursters, 
accelerating your ship forward or backward, then you can turn around and see how 
it keeps its speed.

This can be very tricky to control. To help this, press `O` (oh) to switch to 
_"compensated" flight mode_. In this mode, `W` and `S` can be used to adjust 
your intended speed (you can see it at the bottom of the screen) instead of 
firing the thrusters directly. Then the computer will automatically fire the 
needed thrusters to accelerate or deccelerate you to this speed as well as to 
compensate for any drift your ship might have sideways.
You can maneuver an agile fighter comfortably this way flying around 50-100 m/s.

FOR DEVELOPERS
==============

I'm using the NetBeans IDE (8.0) with its web development plugins to develop 
this application, so it can be opened as a project, if you have the same.
(I can recommend this environment in general as I find it quite handy)

__Examine the code__ starting from the _armada.js_ file. Key points are the
`ResourceCenter` and `Scene` classes in _graphics.js_ and the `Level` and 
`Spacecraft` classes in _logic.js_. Check also _classes.xml_ and _shaders.xml_.

If you wish to check the __documentation__, use JsDoc to generate the updated files
before you do, as I don't generate and push them very often.

It was mainly intended to be a _learning project_ for me to practice and develop
my JavaScript and WebGL skills, therefore I made my design choices based on what
helped me to learn more about the fundaments and particulars of these 
technologies. (hence not using any 3rd party WebGL or physics library, etc)

Krisztián Nagy
14.09.2014.