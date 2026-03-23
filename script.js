let productosFull = [];
let productosFiltrados = [];
let seleccionados = [];

let visibleCount = 50;
const INCREMENTO = 50;

/* =========================
   IDENTIFICADOR
========================= */
function getID(p) {
  return `${p.CODIGO || ''}_${p.DESCRIPCION || ''}`;
}

/* =========================
   UTILIDADES
========================= */
function parsePrecio(str) {
  if (!str) return 0;
  
  let s = String(str).trim().replace(/S\/\.?\s?/g, '');
  
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, ''); // Si hay ambos, la coma es separador de miles
  } else if (s.includes(',')) {
    s = s.replace(',', '.'); // Si solo hay coma, la tratamos como decimal
  }
  
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/* =========================
   ACTUALIZAR TOTAL GLOBAL
========================= */
function actualizarTotalGlobal() {
  const totalFinal = seleccionados.reduce((acc, item) => {
    const p = parsePrecio(item.PREC_CAJA);
    return acc + (p * item.cantidad);
  }, 0).toFixed(2);
  
  const totalEl = document.getElementById('total');
  if (totalEl) totalEl.textContent = totalFinal;
  
  return totalFinal;
}

/* =========================
   LOCAL STORAGE
========================= */
function guardarPedidoLocal() {
  localStorage.setItem("pedidoGuardado", JSON.stringify(seleccionados));
}

function cargarPedidoLocal() {
  const data = localStorage.getItem("pedidoGuardado");
  if (data) {
    seleccionados = JSON.parse(data);
  }
}

function limpiarPedidoLocal() {
  localStorage.removeItem("pedidoGuardado");
}

/* =========================
   INICIO
========================= */
async function init() {
  productosFull = await cargarCSV('data/productos.csv');
  const vendedores = await cargarCSV('data/vendedores.csv');

  const selVendedor = document.getElementById('vendedor');
  if (selVendedor && vendedores.length > 0) {
    vendedores.forEach(v => {
      if(!v.wsp) return; 
      const opt = document.createElement('option');
      opt.value = v.wsp;
      opt.textContent = v.vendedor || 'Vendedor sin nombre';
      selVendedor.appendChild(opt);
    });
  }

  productosFiltrados = [...productosFull];

  cargarPedidoLocal();
  actualizarTotalGlobal(); 

  renderTabla();
  actualizarTablaResumen();

  /* EVENTOS BOTONES */
  document.getElementById('btnMas').addEventListener('click', () => {
    visibleCount += INCREMENTO;
    renderTabla();
  });

  document.getElementById('enviar').addEventListener('click', enviarWhatsApp);
  document.getElementById('btnFoto').addEventListener('click', descargarFoto);
  document.getElementById('btnPDF').onclick = generarPDF;
  document.getElementById('btnBorrarTodo').addEventListener('click', vaciarPedidoCompleto);

  /* BUSCADOR */
  let timer;
  document.getElementById('buscar').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const term = e.target.value.toLowerCase().trim();

      if (term === "") {
        productosFiltrados = [...productosFull];
      } else {
        productosFiltrados = productosFull.filter(p => {
          const nombre = (p.DESCRIPCION || "").toLowerCase();
          const principio = (p.PRINCIPIO_ACTIVO || "").toLowerCase();
          return nombre.includes(term) || principio.includes(term);
        });
      }

      visibleCount = INCREMENTO;
      renderTabla();
    }, 300);
  });
}

/* =========================
   CARGAR CSV
========================= */
async function cargarCSV(url) {
  try {
    const res = await fetch(url);
    if(!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder('iso-8859-1');
    const text = decoder.decode(buffer);
    
    const rows = text.trim().split(/\r?\n/).filter(row => row.trim() !== '');
    if(rows.length === 0) return [];

    const headers = rows.shift().split(';').map(h => h.trim().replace(/\./g, '_'));

    return rows.map(row => {
      const cols = row.split(';');
      const obj = {};
      headers.forEach((h, i) => obj[h] = cols[i]?.trim() || '');
      return obj;
    });
  } catch (err) {
    console.error(`Error cargando CSV de ${url}:`, err);
    return [];
  }
}

/* =========================
   TABLA PRODUCTOS
========================= */
function renderTabla() {
  const theadRow = document.getElementById('headers');
  const tbody = document.getElementById('cuerpoTabla');
  const btnMas = document.getElementById('btnMas');

  if (theadRow.innerHTML === '' && productosFiltrados.length > 0) {
    const keys = Object.keys(productosFiltrados[0] || {});
    keys.forEach(k => {
      const th = document.createElement('th');
      th.textContent = k.replace(/_/g, '.');
      theadRow.appendChild(th);
    });
    theadRow.innerHTML += '<th>CANTIDAD</th><th>SUBTOTAL</th>';
  }

  tbody.innerHTML = '';
  const fin = Math.min(visibleCount, productosFiltrados.length);

  for (let i = 0; i < fin; i++) {
    const p = productosFiltrados[i];
    const tr = document.createElement('tr');

    const vencimiento = p.FEC_VCTO || "";
    if (vencimiento.includes("2026")) {
      tr.style.backgroundColor = "#ffebeb";
      tr.style.color = "#d32f2f";
      tr.style.fontWeight = "bold";
    }

    Object.values(p).forEach(val => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    const precioUnitario = parsePrecio(p.PREC_CAJA);
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

  if (btnMas) {
    btnMas.style.display = fin < productosFiltrados.length ? 'block' : 'none';
  }
}

/* =========================
   ACTUALIZAR SELECCIÓN
========================= */
function actualizarSeleccion(producto, cantidad) {
  const id = getID(producto);
  const idx = seleccionados.findIndex(s => getID(s) === id);

  if (cantidad > 0) {
    if (idx > -1) {
      seleccionados[idx].cantidad = cantidad;
    } else {
      seleccionados.push({ ...producto, cantidad });
    }
  } else {
    if (idx > -1) {
      seleccionados.splice(idx, 1);
    }
  }

  actualizarTotalGlobal();
  actualizarTablaResumen();
  guardarPedidoLocal();
}

/* =========================
   TABLA RESUMEN
========================= */
function actualizarTablaResumen() {
  const tbodyResumen = document.getElementById('cuerpoResumen');
  const totalResumen = document.getElementById('totalResumen');
  const btnBorrarTodo = document.getElementById('btnBorrarTodo');

  tbodyResumen.innerHTML = '';

  if (seleccionados.length === 0) {
    tbodyResumen.innerHTML = '<tr><td colspan="7" style="text-align:center;color:gray;">Aún no has seleccionado productos.</td></tr>';
    if(totalResumen) totalResumen.textContent = '0.00';
    if(btnBorrarTodo) btnBorrarTodo.style.display = 'none'; 
    return;
  }

  if(btnBorrarTodo) btnBorrarTodo.style.display = 'block'; 

  seleccionados.forEach(p => {
    const precioUnit = parsePrecio(p.PREC_CAJA);
    const sub = (precioUnit * p.cantidad).toFixed(2);
    const lab = p.COD_LABO || 'N/A';
    const vence = p.FEC_VCTO || 'N/A';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.DESCRIPCION}</td>
      <td>${lab}</td>
      <td>${vence}</td>
      <td style="text-align:center;">${p.cantidad}</td>
      <td>S/ ${precioUnit.toFixed(2)}</td>
      <td style="font-weight:bold;">S/ ${sub}</td>
      <td style="text-align:center;" class="col-accion">
        <button class="btn-borrar" onclick="eliminarDelResumen('${getID(p)}')">✕</button>
      </td>
    `;
    tbodyResumen.appendChild(tr);
  });

  const totalDOM = document.getElementById('total');
  if(totalResumen && totalDOM) {
    totalResumen.textContent = totalDOM.textContent;
  }
}

/* =========================
   ELIMINAR INDIVIDUAL
========================= */
function eliminarDelResumen(idUnico) {
  const p = seleccionados.find(s => getID(s) === idUnico);
  if (p) {
    actualizarSeleccion(p, 0);
    renderTabla();
  }
}

/* =========================
   VACIAR PEDIDO COMPLETO
========================= */
function vaciarPedidoCompleto() {
  if (confirm("¿Estás seguro de que deseas eliminar todos los productos del pedido?")) {
    seleccionados = [];
    limpiarPedidoLocal();
    actualizarTotalGlobal();
    actualizarTablaResumen();
    renderTabla(); 
  }
}

/* =========================
   PREPARAR VISTA PARA EXPORTAR (Clon de PC para Móvil)
========================= */
function prepararVistaExportacion(contenedor) {
  const clienteDOM = document.getElementById("clienteNombre");
  const notasDOM = document.getElementById("notasVendedor");
  const cliente = clienteDOM && clienteDOM.value ? clienteDOM.value : "Cliente General";
  const notas = notasDOM ? notasDOM.value.trim() : "";
  const fecha = new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });

  // Ocultar botones y columnas de acción
  const elementosOcultar = contenedor.querySelectorAll('.col-accion, .btn-borrar');
  elementosOcultar.forEach(el => el.style.display = 'none');

  const headerResumen = document.getElementById("header-resumen");
  const boxCliente = document.getElementById("box-cliente");
  const boxNotas = document.getElementById("box-notas");
  
  if(headerResumen) headerResumen.style.display = 'none';
  if(boxCliente) boxCliente.style.display = 'none';
  if(boxNotas) boxNotas.style.display = 'none';

  // Aplicamos la clase de exportación
  contenedor.classList.add('modo-exportacion');

  const headerInfo = document.createElement("div");
  headerInfo.id = "temp-export-header";
  headerInfo.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #004b87; padding-bottom: 10px; margin-bottom: 15px;">
        <div>
            <h1 style="margin: 0; color: #004b87; font-size: 26px; font-weight: 900;">GRUPO DIALEX</h1>
            <p style="margin: 4px 0 0 0; color: #666; font-size: 12px;">Distribuidora de Productos Farmacéuticos</p>
        </div>
        <div style="text-align: right;">
            <h2 style="margin: 0; color: #333; font-size: 18px; text-transform: uppercase;">Detalle de Pedido</h2>
            <p style="margin: 4px 0 0 0; color: #555; font-size: 13px;"><strong>Fecha:</strong> ${fecha}</p>
        </div>
    </div>
    <div style="background-color: #f4f7f6; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 5px solid #004b87;">
        <p style="margin: 0; font-size: 14px; color: #333;"><strong>Cliente / Farmacia:</strong> ${cliente}</p>
    </div>
  `;
  contenedor.prepend(headerInfo);

  const style = document.createElement('style');
  style.id = "temp-export-style";
  style.innerHTML = `
    .modo-exportacion {
        position: fixed !important; /* Sacamos el elemento del flujo del móvil */
        top: 0 !important;
        left: 0 !important;
        width: 1000px !important; /* Forzamos ancho de escritorio */
        background: white !important;
        padding: 30px !important;
        z-index: -9999 !important; /* Lo ocultamos detrás de la vista actual */
        box-sizing: border-box !important;
    }
    .modo-exportacion table { width: 100% !important; border-collapse: collapse !important; margin-bottom: 20px; font-size: 13px; }
    .modo-exportacion th { background-color: #004b87 !important; color: white !important; padding: 12px 10px; text-align: left; }
    .modo-exportacion td { padding: 10px; border: 1px solid #ddd; color: #333; }
    .modo-exportacion tr:nth-child(even) { background-color: #f9f9f9 !important; }
    .modo-exportacion h4 { text-align: right; font-size: 18px; color: #004b87; margin-top: 15px; }
  `;
  document.head.appendChild(style);

  if (notas !== "") {
    const notasInfo = document.createElement("div");
    notasInfo.id = "temp-export-notas";
    notasInfo.innerHTML = `
      <div style="margin-top: 25px; padding: 15px; background: #fffde7; border: 1px solid #fff59d; border-radius: 5px;">
        <h4 style="margin: 0 0 8px 0; color: #f57f17; text-align: left; font-size: 14px;">📝 Notas del Pedido:</h4>
        <p style="margin: 0; white-space: pre-wrap; color: #555; font-size: 13px;">${notas}</p>
      </div>
    `;
    const subtotalH4 = contenedor.querySelector('h4');
    if(subtotalH4) contenedor.insertBefore(notasInfo, subtotalH4);
    else contenedor.appendChild(notasInfo);
  }
}

/* =========================
   RESTAURAR VISTA
========================= */
function restaurarVistaExportacion(contenedor) {
  const elementosOcultar = contenedor.querySelectorAll('.col-accion, .btn-borrar');
  elementosOcultar.forEach(el => el.style.display = '');

  const headerResumen = document.getElementById("header-resumen");
  const boxCliente = document.getElementById("box-cliente");
  const boxNotas = document.getElementById("box-notas");
  
  if(headerResumen) headerResumen.style.display = 'flex';
  if(boxCliente) boxCliente.style.display = 'block';
  if(boxNotas) boxNotas.style.display = 'block';

  contenedor.classList.remove('modo-exportacion');
  const style = document.getElementById("temp-export-style");
  const header = document.getElementById("temp-export-header");
  const notas = document.getElementById("temp-export-notas");
  
  if (style) style.remove();
  if (header) header.remove();
  if (notas) notas.remove();
}

/* =========================
   DESCARGAR IMAGEN
========================= */
function descargarFoto() {
  if (seleccionados.length === 0) return alert("El pedido está vacío.");
  const contenedor = document.getElementById('resumen-contenedor');
  prepararVistaExportacion(contenedor);

  setTimeout(() => {
    html2canvas(contenedor, { 
      scale: 2,
      useCORS: true,
      width: 1000, // Forzamos a la cámara a capturar 1000px
      windowWidth: 1000 // Forzamos al navegador a renderizar 1000px
    }).then(canvas => {
      const cliente = document.getElementById("clienteNombre").value || "Cliente";
      const link = document.createElement('a');
      link.download = `Pedido_${cliente}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      restaurarVistaExportacion(contenedor);
    });
  }, 500); 
}

/* =========================
   GENERAR PDF (VERSIÓN FINAL - SIN ERRORES)
========================= */
function generarPDF() {
  // Verificamos que haya productos seleccionados
  if (!seleccionados || seleccionados.length === 0) {
    return alert("El pedido está vacío.");
  }

  try {
    // 1. Inicializar jsPDF (Usamos la librería que ya tienes en el HTML)
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // 2. Obtener datos del formulario
    const cliente = document.getElementById("clienteNombre")?.value || "Cliente General";
    const notas = document.getElementById("notasVendedor")?.value.trim() || "";
    const fecha = new Date().toLocaleDateString('es-PE');
    const totalGlobal = document.getElementById('total')?.textContent || "0.00";

    // --- ENCABEZADO CORPORATIVO ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 75, 135); // Azul Dialex
    doc.text("GRUPO DIALEX", 15, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Distribuidora de Productos Farmacéuticos", 15, 25);

    doc.setFontSize(14);
    doc.setTextColor(50);
    doc.text("DETALLE DE PEDIDO", 195, 20, { align: "right" });
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${fecha}`, 195, 26, { align: "right" });

    // Línea divisoria
    doc.setDrawColor(0, 75, 135);
    doc.setLineWidth(0.5);
    doc.line(15, 30, 195, 30);

    // Bloque de Cliente
    doc.setFillColor(245, 245, 245);
    doc.rect(15, 35, 180, 10, 'F');
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`Cliente / Farmacia: ${cliente}`, 20, 41.5);

    // --- PREPARAR DATOS PARA LA TABLA ---
    const columnas = ["Producto", "Laboratorio", "Vencimiento", "Cant.", "P. Unit", "Subtotal"];
    const filas = seleccionados.map(p => {
      const precioUnit = parsePrecio(p.PREC_CAJA);
      const sub = (precioUnit * p.cantidad).toFixed(2);
      return [
        p.DESCRIPCION || 'N/A',
        p.COD_LABO || 'N/A',
        p.FEC_VCTO || 'N/A',
        p.cantidad,
        `S/ ${precioUnit.toFixed(2)}`,
        `S/ ${sub}`
      ];
    });

    // --- GENERAR TABLA (AutoTable) ---
    // Este método NO toma fotos, por eso NO sale en blanco
    doc.autoTable({
      startY: 50,
      head: [columnas],
      body: filas,
      theme: 'striped',
      headStyles: { fillColor: [0, 75, 135], textColor: 255, fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 70 }, // Producto
        3: { halign: 'center' }, // Cantidad
        4: { halign: 'right' }, // P. Unit
        5: { halign: 'right', fontStyle: 'bold' } // Subtotal
      }
    });

    // --- PIE DE PÁGINA: TOTAL Y NOTAS ---
    const finalY = doc.lastAutoTable.finalY;
    
    doc.setFontSize(12);
    doc.setTextColor(0, 75, 135);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL ESTIMADO: S/ ${totalGlobal}`, 195, finalY + 12, { align: "right" });

    if (notas) {
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.setFont("helvetica", "italic");
      const splitNotas = doc.splitTextToSize(`Notas adicionales: ${notas}`, 170);
      doc.text(splitNotas, 15, finalY + 20);
    }

    // --- GUARDAR ARCHIVO ---
    doc.save(`Pedido_${cliente.replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
    console.error("Error en generarPDF:", error);
    alert("Hubo un fallo al generar el PDF. Revisa que las librerías estén cargadas.");
  }
}

/* =========================
   WHATSAPP
========================= */
function enviarWhatsApp() {
  if (seleccionados.length === 0) return alert("Pedido vacío");

  const selVendedor = document.getElementById('vendedor');
  const txtNotas = document.getElementById('notasVendedor');
  
  const wsp = selVendedor ? selVendedor.value : null;
  const notas = txtNotas ? txtNotas.value.trim() : "";

  if (!wsp) return alert("Selecciona vendedor");

  let msgStr = `*NUEVO PEDIDO*\n==========================\n`;

  seleccionados.forEach((p, i) => {
    const precioUnit = parsePrecio(p.PREC_CAJA);
    const sub = (precioUnit * p.cantidad).toFixed(2);
    const lab = p.COD_LABO || 'N/A';
    const vence = p.FEC_VCTO || 'N/A';
    
    msgStr += `${i + 1}) ${p.DESCRIPCION}\n`;
    msgStr += `- Lab: ${lab} | Vence: ${vence}\n`;
    msgStr += `- Cant: ${p.cantidad} | S/ ${sub}\n\n`;
    msgStr += `- P.Unit: S/ ${precioUnit.toFixed(2)} | Cant: ${p.cantidad}\n`;
    msgStr += `- Subtotal: S/ ${sub}\n\n`;
  });

  msgStr += `==========================\n`;
  msgStr += `TOTAL: S/ ${document.getElementById('total').textContent}`;

  if (notas !== "") {
    msgStr += `\n\n📝 NOTAS PARA EL VENDEDOR:\n${notas}`;
  }

  const whatsappUrl = `https://wa.me/${wsp}?text=${encodeURIComponent(msgStr)}`;
  
  window.open(whatsappUrl, '_blank');

  // Asegúrate de que estas llaves existan:
} // Cierra enviarWhatsApp

init(); // Ejecuta la inicialización al cargar la página
