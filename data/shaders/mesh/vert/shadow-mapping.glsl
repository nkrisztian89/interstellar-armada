v_index = a_index.xy;

// applying the same transformation that was applied when creating the shadow maps for light i
for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
    if (i < u_numDirLights) {
        v_shadowMapPosition[i] = (u_dirLights[i].matrix * gl_Position).xyz;
        // an offset will be applied based on the normal when checking whether the fragment is obscured
        v_shadowMapNormal[i] = normalize((u_dirLights[i].matrix * u_modelMatrix * vec4(a_position + a_normal, 1.0)).xyz - v_shadowMapPosition[i]);
        // when sampling the shadow maps, the offsets defining the sampling points will be transformed based on the surface normal, because
        // surfaces that are close to being parallel to the light direction need tighter sampling points to eliminate artifacts (false
        // positives) caused by PCF leaking
        vec3 yTransform = cross(v_shadowMapNormal[i], vec3(1.0, 0.0, 0.0));
        vec3 xTransform = cross(yTransform, v_shadowMapNormal[i]);
        yTransform = cross(v_shadowMapNormal[i], xTransform);
        v_shadowMapSampleOffsetTransform[i][0] = xTransform.xy;
        v_shadowMapSampleOffsetTransform[i][1] = yTransform.xy;
    }
}