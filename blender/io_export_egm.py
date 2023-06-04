import bpy
from bpy.props import (
    StringProperty,
)
from bpy_extras.io_utils import (
    ExportHelper,
)
from bpy.types import (
    Operator,
)

bl_info = {
    "name": "EgomModel export",
    "author": "Krisztián Nagy",
    "version": (1, 0, 0),
    "blender": (3, 5, 1),
    "location": "File > Import-Export",
    "description": "Adds support to export models in the EgomModel (.egm) file format, version 3.6",
    "category": "Import-Export",
    "support": "COMMUNITY",
}

# Vertex group weights are multiplied by this factor to get EGM group index
# values
WEIGHT_FACTOR = 1000


# Get EGM group index from VertexGroupElement 'group'
def get_group_index_from_group(group):
    return round(group.weight * WEIGHT_FACTOR)


# Get EGM group index for MeshLoopTriangle 'triangle' inside object 'ob' of
# group with index 'group'
def get_group_index(ob, triangle, group):
    i1 = 0
    i2 = 0
    i3 = 0
    v = ob.data.vertices[triangle.vertices[0]]
    for g in v.groups:
        if g.group == group:
            i1 = get_group_index_from_group(g)
    v = ob.data.vertices[triangle.vertices[1]]
    for g in v.groups:
        if g.group == group:
            i2 = get_group_index_from_group(g)
    v = ob.data.vertices[triangle.vertices[2]]
    for g in v.groups:
        if g.group == group:
            i3 = get_group_index_from_group(g)
    if i1 != i2 or i1 != i3:
        return 0
    return i1


# Convert float to string with rounding (max 4 decimals)
def f2s(x):
    return f'{(round(x * 10000) / 10000):g}'


# Convert float to string with rounding (max 3 decimals)
def f2s3(x):
    return f'{(round(x * 1000) / 1000):g}'


def get_lod_from_object(ob, minLOD, maxLOD):
    if 'minLOD' in ob:
        obMinLOD = ob['minLOD']
    elif 'minLOD' in ob.data:
        obMinLOD = ob.data['minLOD']
    else:
        obMinLOD = minLOD
    if 'maxLOD' in ob:
        obMaxLOD = ob['maxLOD']
    elif 'maxLOD' in ob.data:
        obMaxLOD = ob.data['maxLOD']
    else:
        obMaxLOD = maxLOD
    return (obMinLOD, obMaxLOD)


def get_lod_string(ob, minLOD, maxLOD):
    (obMinLOD, obMaxLOD) = get_lod_from_object(ob, minLOD, maxLOD)
    if obMinLOD != minLOD or obMaxLOD != maxLOD:
        return ","+str(obMinLOD)+","+str(obMaxLOD)
    else:
        return ""


# Return the color to be exported for the passed blender material
def get_color(material):
    # Materials created by the EGM importer have a node group with the color
    # passed in as the input
    if 'Group' in material.node_tree.nodes:
        gr = material.node_tree.nodes['Group']
        return gr.inputs['Color'].default_value
    # If not created by the importer, export the default color value of the
    # default BSDF shader, if it exists
    if 'Principled BSDF' in material.node_tree.nodes:
        pr = material.node_tree.nodes['Principled BSDF']
        return pr.inputs['Base Color'].default_value
    else:
        return [1, 1, 1, 1]


def vec_eq(v1, v2):
    return v1[0] == v2[0] and v1[1] == v2[1] and v1[2] == v2[2]


def get_triangles(obs, vstart, minLOD, maxLOD, transparent):
    ttext = []
    prev_lu = 0
    prev_tr = 0
    prev_mat = 0
    prev_normals = []
    oindex = 0
    conv_triangles = []
    for ob in obs:
        lod_string = get_lod_string(ob, minLOD, maxLOD)
        ob_lod = get_lod_from_object(ob, minLOD, maxLOD)
        # Triangulate faces, calculate split normals
        ob.data.calc_loop_triangles()
        ob.data.calc_normals_split()
        # Determine the indices of the transform and luminosity vertex groups,
        # if they exist
        if 'transform' in ob.vertex_groups:
            tra = ob.vertex_groups['transform'].index
        else:
            tra = -1
        if 'luminosity' in ob.vertex_groups:
            lum = ob.vertex_groups['luminosity'].index
        else:
            lum = -1
        triangles = ob.data.loop_triangles
        first = True
        uvs = []
        uv = ob.data.uv_layers.active.data
#        loops = ob.data.loops
        for t in triangles:
            # Skip transparent triangles for opaque list and vice versa
            mat = obs[0].material_slots[t.material_index].material
            if (get_color(mat)[3] < 1) != transparent:
                continue
            # Vertex indices and color
            start = vstart[oindex]
            if t.vertices[0] < t.vertices[1] and t.vertices[0] < t.vertices[2]:
                a = t.vertices[0]
                b = t.vertices[1]
                c = t.vertices[2]
                la = t.loops[0]
                lb = t.loops[1]
                lc = t.loops[2]
                normals = t.split_normals
            elif (t.vertices[1] < t.vertices[0] and
                  t.vertices[1] < t.vertices[2]):
                a = t.vertices[1]
                b = t.vertices[2]
                c = t.vertices[0]
                la = t.loops[1]
                lb = t.loops[2]
                lc = t.loops[0]
                normals = [t.split_normals[1],
                           t.split_normals[2],
                           t.split_normals[0]]
            else:
                a = t.vertices[2]
                b = t.vertices[0]
                c = t.vertices[1]
                la = t.loops[2]
                lb = t.loops[0]
                lc = t.loops[1]
                normals = [t.split_normals[2],
                           t.split_normals[0],
                           t.split_normals[1]]
            tt = "[["+str(start+a)+","+str(b-a)+","+str(c-a)
            conv_triangle = [[start+a, b-a, c-a, t.material_index]]
            if t.material_index != prev_mat:
                tt += ","+str(t.material_index)
                prev_mat = t.material_index
            # Texture coordinates
            if (first or (
                  uvs[0] != uv[la].uv[0] or
                  uvs[1] != 1 - uv[la].uv[1] or
                  uvs[2] != uv[lb].uv[0] or
                  uvs[3] != 1 - uv[lb].uv[1] or
                  uvs[4] != uv[lc].uv[0] or
                  uvs[5] != 1 - uv[lc].uv[1])):
                uvs = [uv[la].uv[0],
                       1 - uv[la].uv[1],
                       uv[lb].uv[0],
                       1 - uv[lb].uv[1],
                       uv[lc].uv[0],
                       1 - uv[lc].uv[1]]
                tt += "," + ",".join(map(f2s3, uvs))
            conv_triangle.append(uvs)
            if first:
                tt += lod_string
                first = False
            tt += "]"
            conv_triangle.append(ob_lod)
            # Normal vectors
            normals_written = False
            # Check if we have split normals differing from the main one
            if (
                  normals[0][0] != t.normal.x or
                  normals[0][1] != t.normal.y or
                  normals[0][2] != t.normal.z or
                  normals[1][0] != t.normal.x or
                  normals[1][1] != t.normal.y or
                  normals[1][2] != t.normal.z or
                  normals[2][0] != t.normal.x or
                  normals[2][1] != t.normal.y or
                  normals[2][2] != t.normal.z):
                # Check if our split normals are different from the ones of the
                # previous triangle
                if (len(prev_normals) != 3
                    or not all(
                    [vec_eq(prev_normals[i], normals[i])
                     for i in range(len(normals))
                     ])):
                    tt += (",[" + f2s(normals[0][0]) + ","
                                + f2s(normals[0][1]) + ","
                                + f2s(normals[0][2]) + ","
                                + f2s(normals[1][0]) + ","
                                + f2s(normals[1][1]) + ","
                                + f2s(normals[1][2]) + ","
                                + f2s(normals[2][0]) + ","
                                + f2s(normals[2][1]) + ","
                                + f2s(normals[2][2]))
                    prev_normals = normals
                    normals_written = True
            else:
                # Check if the main normal is different from the one of the
                # previous triangle
                if (len(prev_normals) != 1 or
                   t.normal.x != prev_normals[0][0] or
                   t.normal.y != prev_normals[0][1] or
                   t.normal.z != prev_normals[0][2]):
                    tt += (",["
                           + f2s(t.normal.x) + ","
                           + f2s(t.normal.y) + ","
                           + f2s(t.normal.z))
                    prev_normals = [[t.normal.x, t.normal.y, t.normal.z]]
                    normals_written = True
            conv_triangle.append(prev_normals)
            # Group indices
            tr = 0
            lu = 0
            if tra >= 0:
                tr = get_group_index(ob, t, tra)
            if lum >= 0:
                lu = get_group_index(ob, t, lum)
            if tr == prev_tr and lu == prev_lu:
                if normals_written:
                    tt += "]"
            else:
                if not normals_written:
                    tt += ",["
                else:
                    tt += ","
                tt += str(tr)+","+str(lu)+"]"
            prev_tr = tr
            prev_lu = lu
            conv_triangle.append((prev_tr, prev_lu))
            tt += "]"
            ttext.append(tt)
            conv_triangles.append(conv_triangle)
        oindex += 1
#    return conv_triangles
    return ",".join(ttext)


# Export blender objects 'obs' into an EgomModel file at 'path'
def write_egm(path, obs):
    # Determining minimum and maximum LOD considering all of the objects
    minLOD = 999
    maxLOD = -1
    for ob in obs:
        # Min and max LOD for an object can be specified in the custom
        # properties 'minLOD' and 'maxLOD'
        if 'minLOD' in ob:
            minLOD = min(minLOD, ob['minLOD'])
        elif 'minLOD' in ob.data:
            minLOD = min(minLOD, ob.data['minLOD'])
        if 'maxLOD' in ob:
            maxLOD = max(maxLOD, ob['maxLOD'])
        elif 'maxLOD' in ob.data:
            maxLOD = max(maxLOD, ob.data['maxLOD'])
    # Default values in case none was specified in the objects
    if minLOD >= 999:
        minLOD = 0
    if maxLOD < 0:
        maxLOD = 4
    # Write file header
    f = open(path, "w")
    f.write('{"format":"EgomModel","version":"3.6","info":{"name":"'
            + bpy.path.clean_name(obs[0].name)
            + '","author":"Krisztian Nagy","scale":'
            + f2s3(obs[0].scale[0])
            + ',"LOD":[' + str(minLOD) + ',' + str(maxLOD)
            + '],"colorPalette":[')
    # Export color palette based on the materials of the first object
    # All objects must share the same materials in the same slots
    mtext = []
    for m in obs[0].material_slots:
        color = get_color(m.material)
        mtext.append("["
                     + f2s3(color[0]) + ","
                     + f2s3(color[1]) + ","
                     + f2s3(color[2]) + ","
                     + f2s3(color[3]) + "]")
    f.write(",".join(mtext))
    # Export vertices
    f.write(']},"vertices":[')
    vtext = []
    vstart = []
    vindex = 0
#    conv_vertices = []
    for ob in obs:
        (obMinLOD, obMaxLOD) = get_lod_from_object(ob, minLOD, maxLOD)
        lod_string = get_lod_string(ob, minLOD, maxLOD)
        vertices = ob.data.vertices
        first = True
        vstart.append(vindex)
        vindex += len(vertices)
        for v in vertices:
            vtext.append("["
                         + f2s3(v.co[0]) + ","
                         + f2s3(v.co[1]) + ","
                         + f2s3(v.co[2]) +
                         (lod_string if first else "") + "]")
#            conv_vertices.append([f2s3(v.co[0]),f2s3(v.co[1]),f2s3(v.co[2]),obMinLOD,obMaxLOD])
            first = False
    f.write(",".join(vtext))
    # Export polygons
    f.write('],"polygons":[')
    opaque_triangles = get_triangles(obs, vstart, minLOD, maxLOD, False)
    transparent_triangles = get_triangles(obs, vstart, minLOD, maxLOD, True)

    f.write(opaque_triangles)
    if opaque_triangles and transparent_triangles:
        f.write(",")
    f.write(transparent_triangles)
    f.write("]}")
    f.close()


class ExportEGM(Operator, ExportHelper):
    bl_idname = "export_mesh.egm"
    bl_label = "Export EGM"
    bl_description = """Save mesh data in EgomModel format"""

    filename_ext = ".egm"
    filter_glob: StringProperty(default="*.egm", options={'HIDDEN'})

    def execute(self, context):
        write_egm(self.filepath, context.selected_objects)
        return {'FINISHED'}

    def draw(self, context):
        pass


def menu_export(self, context):
    self.layout.operator(ExportEGM.bl_idname, text="EgomModel (.egm)")


classes = (
    ExportEGM,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.TOPBAR_MT_file_export.append(menu_export)


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)
    bpy.types.TOPBAR_MT_file_export.remove(menu_export)


if __name__ == "__main__":
    register()
