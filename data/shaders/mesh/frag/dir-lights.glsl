for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
    if (i < u_numDirLights) {
        gl_FragColor.rgb += diffuseColor.rgb * u_dirLights[i].color * max(0.0, dot(+u_dirLights[i].direction, normal));
        gl_FragColor.rgb += texSpec.rgb * u_dirLights[i].color * (shininess > 0.0 ? pow(max(dot(normal, normalize(u_dirLights[i].direction - viewDir)), 0.0), shininess) : 0.0);
    }
}