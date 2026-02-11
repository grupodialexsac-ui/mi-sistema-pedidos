let productosFull = [];   
let productosFiltrados = []; 
let seleccionados = [];   
let visibleCount = 50;    
const INCREMENTO = 50;    

function getID(p) {
    return `${p.CODIGO || ''}_${p.DESCRIPCION || ''}`;
}

async function init() {
    productosFull = await cargarCSV('data/productos.csv');
    const vendedores = await cargarCSV('data/vendedores.csv');

    const selVendedor = document.getElementById('vendedor');
    if (selVendedor) {
        vendedores.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.wsp;
            opt.textContent = v.vendedor;
            selVendedor.appendChild(opt);
        });
    }

    productosFiltrados = [...productosFull];
    renderTabla();
    
    document.getElementById('btnMas').addEventListener('click', () => {
        visibleCount += INCREMENTO;
        renderTabla();
    });

    document.getElementById('enviar').addEventListener('click', enviarWhatsApp);
    
    let timer;
    document.getElementById('buscar').addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            const term = e.target.value.toLowerCase().trim();
            if (term === "") {
                productosFiltrados = [...productosFull];
            } else {
                let resultados = productosFull.filter(p => {
                    const nombre = (p.DESCRIPCION || "").toLowerCase();
                    const principio = (p.PRINCIPIO_ACTIVO || "").toLowerCase();
                    return nombre.includes(term) || principio.includes(term);
                });

                productosFiltrados = resultados.sort((a, b) => {
                    const descA = (a.DESCRIPCION || "").toLowerCase();
                    const descB = (b.DESCRIPCION || "").toLowerCase();
                    const empiezaA = descA.startsWith(term);
                    const empiezaB = descB.startsWith(term);
                    if (empiezaA && !empiezaB) return -1;
                    if (!empiezaA && empiezaB) return 1;
                    return descA.localeCompare(descB);
                });
            }
            visibleCount = INCREMENTO; 
            document.getElementById('cuerpoTabla').innerHTML = '';
            renderTabla(); 
        }, 300);
    });
}

async function cargarCSV(url) {
    try {
        const res = await fetch(url);
        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder('iso-8859-1'); 
        const text = decoder.decode(buffer);
        const rows = text.trim().split(/\r?\n/);
        const headers = rows.shift().split(';').map(h => h.trim().replace(/\./g,'_'));
        return rows.map(row => {
            const cols = row.split(';');
            const obj = {};
            headers.forEach((h, i) => obj[h] = cols[i]?.trim() || '');
            return obj;
        });
    } catch (err) { return []; }
}

function renderTabla() {
    const theadRow = document.getElementById('headers');
    const tbody = document.getElementById('cuerpoTabla');
    const btnMas = document.getElementById('btnMas');

    if (theadRow.innerHTML === '') {
        const keys = Object.keys(productosFiltrados[0] || {});
        keys.forEach(k => {
            const th = document.createElement('th');
            th.textContent = k.replace(/_/g, '.');
            theadRow.appendChild(th);
        });
        theadRow.innerHTML += '<th>CANTIDAD</th><th>SUBTOTAL</th>';
    }

    // Limpiamos para evitar duplicados al refrescar tras borrar
    tbody.innerHTML = '';
    const fin = Math.min(visibleCount, productosFiltrados.length);

    for (let i = 0; i < fin; i++) {
        const p = productosFiltrados[i];
        const tr = document.createElement('tr');

        const infoProducto = Object.values(p).join(" ");
        if (infoProducto.includes("2026")) {
            tr.style.backgroundColor = "#ffebeb"; 
            tr.style.color = "#d32f2f";            
            tr.style.fontWeight = "bold";
        }

        Object.values(p).forEach(val => {
            const td = document.createElement('td');
            td.textContent = val;
            tr.appendChild(td);
        });

        const precioUnitario = parseFloat(p.PREC_CAJA?.replace(/[^0-9.]/g, '')) || 0;
        const itemCarrito = seleccionados.find(s => getID(s) === getID(p));
        const cantActual = itemCarrito ? itemCarrito.cantidad : 0;

        const tdCant = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = cantActual;
        input.style.width = '60px';

        const tdSub = document.createElement('td');
        tdSub.style.fontWeight = 'bold';
        tdSub.textContent = `S/ ${(precioUnitario * cantActual).toFixed(2)}`;

        input.oninput = (e) => {
            const nCant = parseInt(e.target.value) || 0;
            tdSub.textContent = `S/ ${(precioUnitario * nCant).toFixed(2)}`;
            actualizarSeleccion(p, nCant);
        };
        
        tdCant.appendChild(input);
        tr.appendChild(tdCant);
        tr.appendChild(tdSub);
        tbody.appendChild(tr);
    }
    btnMas.style.display = fin < productosFiltrados.length ? 'block' : 'none';
}

function actualizarSeleccion(producto, cantidad) {
    const id = getID(producto);
    const idx = seleccionados.findIndex(s => getID(s) === id);
    
    if (cantidad > 0) {
        if (idx > -1) seleccionados[idx].cantidad = cantidad;
        else seleccionados.push({ ...producto, cantidad });
    } else {
        if (idx > -1) seleccionados.splice(idx, 1);
    }

    const totalFinal = seleccionados.reduce((acc, item) => {
        const p = parseFloat(item.PREC_CAJA?.replace(/[^0-9.]/g, '')) || 0;
        return acc + (p * item.cantidad);
    }, 0).toFixed(2);
    
    document.getElementById('total').textContent = totalFinal;
    actualizarTablaResumen(); 
}

function actualizarTablaResumen() {
    const tbodyResumen = document.getElementById('cuerpoResumen');
    const totalResumen = document.getElementById('totalResumen');
    tbodyResumen.innerHTML = ''; 

    if (seleccionados.length === 0) {
        tbodyResumen.innerHTML = '<tr><td colspan="5" style="text-align:center; color: gray;">Aún no has seleccionado productos.</td></tr>';
        totalResumen.textContent = '0.00';
        return;
    }

    seleccionados.forEach(p => {
        const tr = document.createElement('tr');
        const precioUnit = parseFloat(p.PREC_CAJA?.replace(/[^0-9.]/g, '')) || 0;
        const sub = (precioUnit * p.cantidad).toFixed(2);

        tr.innerHTML = `
            <td>${p.DESCRIPCION}</td>
            <td style="text-align: center;">${p.cantidad}</td>
            <td>S/ ${precioUnit.toFixed(2)}</td>
            <td style="font-weight: bold;">S/ ${sub}</td>
            <td style="text-align: center;">
                <button class="btn-borrar" onclick="eliminarDelResumen('${getID(p)}')">✕</button>
            </td>
        `;
        tbodyResumen.appendChild(tr);
    });

    totalResumen.textContent = document.getElementById('total').textContent;
}

// Función para eliminar desde la X
function eliminarDelResumen(idUnico) {
    const p = seleccionados.find(s => getID(s) === idUnico);
    if (p) {
        actualizarSeleccion(p, 0); // Lo quita de la lógica
        renderTabla(); // Refresca la tabla principal para poner el input en 0
    }
}

function enviarWhatsApp() {
    if (seleccionados.length === 0) return alert("Pedido vacío");
    const wsp = document.getElementById('vendedor').value;
    if (!wsp) return alert("Selecciona vendedor");

    let msg = `*📦 NUEVO PEDIDO*%0A==========================%0A`;
    seleccionados.forEach((p, i) => {
        const precioUnit = parseFloat(p.PREC_CAJA?.replace(/[^0-9.]/g, '')) || 0;
        const sub = (precioUnit * p.cantidad).toFixed(2);
        
        msg += `*${i+1})* ${p.DESCRIPCION}%0A`;
        msg += `🧪 Lab: _${p.COD_LABO || p.LABO || 'N/A'}_%0A`;
        msg += `💰 Precio-Unitario: S/ ${precioUnit.toFixed(2)}%0A`; 
        msg += `🔹 Cant: *${p.cantidad}* | S/ ${sub}%0A%0A`;
    });
    msg += `==========================%0A*💰 TOTAL: S/ ${document.getElementById('total').textContent}*`;
    window.open(`https://wa.me/${wsp}?text=${msg}`, '_blank');
}

init();