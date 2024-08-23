const rand = (n: number) => 0 | Math.random() * n;

function swap (t: any[], i: number, j: number) {
    const q = t[i];
    t[i] = t[j];
    t[j] = q;
    return t;
}

export default function (arr: any[]) {
    const t = JSON.parse(JSON.stringify(arr));
    let last = t.length;
    let n;
    while (last > 0) {
        n = rand(last);
        swap(t, n, --last);
    }
    return t;
}
