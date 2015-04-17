'use strict';

var Model = {};

/** Sort elements so i1 <= i2 <= i3
 * @param {number} i1
 * @param {number} i2
 * @param {number} i3
 * @param {Vector} v1
 * @param {Vector} v2
 * @param {Vector} v3
 * @return {number, number, number, Vector, Vector, Vector}
 */
Model.sort3 = function(i1, i2, i3, v1, v2, v3) {
    //bubble sort on 3 elements
    var ci, cv;
    if (i1 > i2) {
        ci = i1;
        i1 = i2;
        i2 = ci;
        cv = v1;
        v1 = v2;
        v2 = cv;
    }
    if (i2 > i3) {
        ci = i2;
        i2 = i3;
        i3 = ci;
        cv = v2;
        v2 = v3;
        v3 = cv;
    }
    if (i1 > i2) {
        ci = i1;
        i1 = i2;
        i2 = ci;
        cv = v1;
        v1 = v2;
        v2 = cv;
    }
    return [i1, i2, i3, v1, v2, v3];
};

/** Returns list of normals for each face
 * @param {Vector[]} vertexes - list of rotated vectors
 * @param {int[][3]} faces - list of vertex indexes
 * @return {Vector[]}
 */
Model.get_face_normals = function(vertexes, faces) {
    var normals = [];
    for (var i = 0; i < faces.length; i++) {
        var face = faces[i];
        var v1 = vertexes[face[0]];
        var v2 = vertexes[face[1]];
        var v3 = vertexes[face[2]];
        normals[i] = v2.subtract(v1).cross(v3.subtract(v2)).toUnitVector();
    }
    return normals;
};

/** Returns list of normals for each vertex
 * @param {Vector[]} vertexes - list of rotated vectors
 * @param {int[][3]} faces - list of vertex indexes
 * @return {Vector[]}
 */
Model.get_vertex_normals = function(vertexes, faces) {
    var face_normals = Model.get_face_normals(vertexes, faces);
    var vertex_normals = [];
    for (var i = 0; i < vertexes.length; i++) {
        vertex_normals[i] = $V([0, 0, 0]);
    }
    for (var i = 0; i < faces.length; i++) {
        for (var j = 0; j < 3; j++) {
            var v = faces[i][j];
            vertex_normals[v] = vertex_normals[v].add(face_normals[i]);
        }
    }
    for (var i = 0; i < vertexes.length; i++) {
        vertex_normals[i] = vertex_normals[i].toUnitVector();
    }
    return vertex_normals;
};

/** Convert intensity to html5 color
 * @param {Number} intensity
 * @param {Number} max_light - maximum level of intesity (0..255)
 * @param {Number} ambient_light - minimum level of intesity (0..255)
 * @return {string} html5 color
 */
Model.intensity_to_rgb = function(intensity, max_light, ambient_light) {
    var c = Math.max(Math.floor(intensity * max_light), 0) + ambient_light;
    return 'rgb(' + c + ',' + c + ',' + c + ')';
};

/** Return rotated vertexes
 * @param {Vector[]} vertexes - e.g. [[0.32, 0.43, 0.3], ...]
 * @param {Number[4]} rotations - 4 angles in radians
 *                               [rot_z, rot_y, rot_z, rot_x]
 *                               rotations are applied in specified order
 * @return {Vector[]} rotated vertexes
 */
Model.rotate_vertexes = function(vertexes, rotations) {
    //[rot_z, rot_y, rot_z, rot_x]
    var model_m = (Matrix.RotationX(rotations[3])
                  .multiply(Matrix.RotationZ(rotations[2]))
                  .multiply(Matrix.RotationY(rotations[1]))
                  .multiply(Matrix.RotationZ(rotations[0])));
    var new_vertexes = [];
    for (var i = 0; i < vertexes.length; i++) {
        new_vertexes[i] = model_m.multiply($V(vertexes[i]));
    }
    return new_vertexes;
};

/** Draw asteroid model into canvas
 * @param {element} canvas - element to which the object should be drawn
 * @param {Vector[]} vertexes - e.g. [[0.32, 0.43, 0.3], ...]
 * @param {int[][3]} faces - array of triples of indexes to vertexes
 *               vertex_index is from 0 to vertexes.lenght-1
 *               e.g. [[1,2,3], [2,3,5], ...]
 * @param {Number} ambient_light - level of ambient lightning (0..1.0)
 * @param {Vector} light_direction
 * @param {Vector} observer_direction
 * @param {Vector[]} face_normals - if vertex_normals not present use flat shading
 * @param {Vector[]} vertex_normals - if present shade object with goraud shading
 */
Model.draw = function(canvas, vertexes, faces, ambient_light,
    light_direction, observer_direction, face_normals, vertex_normals) {
    var ctx = canvas.getContext('2d');
    var r = Math.min(canvas.width, canvas.height) / 2 - 5;

    // we suppose that asteroid is in (0, 0, 0)
    // and direction up is in Z axis
    var camera_up = $V([0, 0, 1]);
    var camera_to = $V(observer_direction).multiply(-1).toUnitVector();
    var camera_right = camera_to.cross(camera_up);
    var camera_up = camera_right.cross(camera_to);
    var projection_m = $M([
        camera_up.multiply(r).elements,
        camera_right.multiply(r).elements
    ]);
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // direction to sun
    var light = $V(light_direction).toUnitVector();
    ambient_light = Math.floor(ambient_light * 255);
    var max_light = 255 - ambient_light;

    var projected = vertexes.map((v) => projection_m.multiply(v));
    for (var i = 0; i < faces.length; i++) {
        var face = faces[i];
        var v1 = projected[face[0]];
        var v2 = projected[face[1]];
        var v3 = projected[face[2]];
        var dv1 = v2.subtract(v1).elements;
        var dv2 = v3.subtract(v2).elements;
        var norm = dv1[0] * dv2[1] - dv1[1] * dv2[0];
        var color;
        // cull back side
        // skip collapsed triangles
        if (norm <= 1) continue;

        if (vertex_normals) {
            var i1 = vertex_normals[face[0]].dot(light);
            var i2 = vertex_normals[face[1]].dot(light);
            var i3 = vertex_normals[face[2]].dot(light);
            [i1, i2, i3, v1, v2, v3] = Model.sort3(i1, i2, i3, v1, v2, v3);
            if (i3 - i1 < 0.01) {
                color = Model.intensity_to_rgb(i1, max_light, ambient_light);
            } else {
                var c1 = Model.intensity_to_rgb(i1, max_light, ambient_light);
                var c3 = Model.intensity_to_rgb(i3, max_light, ambient_light);
                // draw a polygon and transform it with matrix
                // to fill into coordinates
                var k = v3.subtract(v1);
                var s = k.multiply((i2 - i1) / (i3 - i1)).add(v1);
                var dir = v2.subtract(s).toUnitVector();
                var n = $V([-dir.e(2), dir.e(1)]);
                if (n.dot(k) > 0) {
                    n.multiply(-1);
                }
                var endpos = n.multiply(k.dot(n)).add(v1);
                color = ctx.createLinearGradient(
                        v1.e(1), v1.e(2), endpos.e(1), endpos.e(2));
                color.addColorStop(0, c1);
                color.addColorStop(1, c3);
            }
        } else if (face_normals) {
            var intensity = face_normals[i].dot(light);
            color = Model.intensity_to_rgb(
                    intensity, max_light, ambient_light);
        } else {
            color = Model.intensity_to_rgb(0, max_light, ambient_light);
        }
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.67;
        ctx.beginPath();
        ctx.moveTo(v1.e(1), v1.e(2));
        ctx.lineTo(v2.e(1), v2.e(2));
        ctx.lineTo(v3.e(1), v3.e(2));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
};

