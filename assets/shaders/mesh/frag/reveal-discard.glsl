// discard fragments that are not revealed yet
if ((u_revealFront == true) && (v_modelPos.y <= u_revealStart)) {
    discard;
} else
if ((u_revealFront == false) && (v_modelPos.y >= u_revealStart)) {
    discard;
// calculate the color of the revealed fragments
} else {