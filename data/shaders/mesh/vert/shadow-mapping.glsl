v_index = a_index.xy;

// applying the same transformation that was applied when creating the shadow maps for light i
for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
    if (i < u_numDirLights) {
        v_shadowMapPosition[i] = u_dirLights[i].matrix * gl_Position;
    }
}