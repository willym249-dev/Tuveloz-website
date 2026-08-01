"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type SiteLanguage = "en" | "es";

const LANGUAGE_KEY = "tuveloz-language";
const LANGUAGE_EVENT = "tuveloz-language-change";

const spanishText: Record<string, string> = {
  "Services": "Servicios",
  "How it works": "Cómo funciona",
  "Reviews": "Reseñas",
  "For providers": "Para proveedores",
  "Give feedback": "Dar opinión",
  "Post a job": "Publicar un trabajo",
  "Local vehicle-service marketplace": "Mercado local de servicios para vehículos",
  "Operating now in Montgomery County, Maryland": "Operando ahora en el Condado de Montgomery, Maryland",
  "Outside the county? Request your area →": "¿Está fuera del condado? Solicite su área →",
  "Need car work?": "¿Necesita trabajo para su vehículo?",
  "Post it. Compare quotes.": "Publíquelo. Compare cotizaciones.",
  "Vehicle services.": "Servicios para vehículos.",
  "Choice for customers. Freedom for providers.": "Opciones para clientes. Libertad para proveedores.",
  "Customers compare available services, providers, and quotes to choose what fits their budget. Providers review matching jobs, set their schedule, and help shape tools that make business simpler.": "Los clientes comparan servicios disponibles, proveedores y cotizaciones para elegir lo que se ajuste a su presupuesto. Los proveedores revisan trabajos compatibles, establecen su horario y ayudan a definir herramientas que simplifican su negocio.",
  "Post a job request": "Publicar una solicitud",
  "Join as a provider": "Unirse como proveedor",
  "Customer choice at every step": "El cliente elige en cada paso",
  "Compare provider quotes before deciding": "Compare cotizaciones antes de decidir",
  "Clear choices on both sides": "Opciones claras para ambos lados",
  "Customers choose providers. Providers choose work.": "Los clientes eligen proveedores. Los proveedores eligen trabajos.",
  "GOOD MORNING": "BUENOS DÍAS",
  "What does your car need?": "¿Qué necesita su vehículo?",
  "Battery": "Batería",
  "Tire": "Llanta",
  "Diagnostics": "Diagnóstico",
  "Window tint": "Polarizado",
  "Provider nearby": "Proveedor cercano",
  "Ready to review requests": "Listo para revisar solicitudes",
  "New quote received": "Nueva cotización recibida",
  "Review the provider's price": "Revise el precio del proveedor",
  "Local independent providers": "Proveedores locales independientes",
  "FOUNDING NETWORK": "RED FUNDADORA",
  "Focused": "Enfoque",
  "local launch": "lanzamiento local",
  "Now serving": "Ahora en",
  "Montgomery County": "Condado de Montgomery",
  "Convenient": "Conveniente",
  "mobile service": "servicio móvil",
  "Independent": "Independientes",
  "local providers": "proveedores locales",
  "Simple": "Simple",
  "booking experience": "experiencia de reserva",
  "Compare": "Compare",
  "available services": "servicios disponibles",
  "provider quotes": "cotizaciones de proveedores",
  "Control": "Controle",
  "your schedule": "su horario",
  "helpful business tools": "herramientas útiles para el negocio",
  "Built for both sides": "Diseñado para ambos lados",
  "One marketplace. Clear benefits for customers and providers.": "Una plataforma. Beneficios claros para clientes y proveedores.",
  "Tuveloz keeps customers in control of their vehicle-service decisions and independent providers in control of their business.": "Tuveloz mantiene a los clientes al control de sus decisiones de servicio para el vehículo y a los proveedores independientes al control de su negocio.",
  "For customers": "Para clientes",
  "Compare your options. Choose what works.": "Compare sus opciones. Elija lo que le convenga.",
  "Request the services your vehicle needs, compare available providers and their quotes, and choose the option that fits your budget.": "Solicite los servicios que necesita su vehículo, compare los proveedores disponibles y sus cotizaciones, y elija la opción que se ajuste a su presupuesto.",
  "Choose from available services": "Elija entre los servicios disponibles",
  "Compare providers and quotes": "Compare proveedores y cotizaciones",
  "You make the final decision": "Usted toma la decisión final",
  "Request vehicle service": "Solicitar servicio para el vehículo",
  "Run your work on your terms.": "Maneje su trabajo a su manera.",
  "Set your availability, review matching jobs, send your price, and choose the opportunities that fit your schedule.": "Defina su disponibilidad, revise trabajos compatibles, envíe su precio y elija las oportunidades que se ajusten a su horario.",
  "Work on your schedule": "Trabaje según su horario",
  "Use one simple job workspace": "Use un solo espacio sencillo para sus trabajos",
  "Request tools that help you grow": "Solicite herramientas que le ayuden a crecer",
  "See provider benefits": "Ver beneficios para proveedores",
  "Current service area": "Área de servicio actual",
  "Montgomery County, Maryland": "Condado de Montgomery, Maryland",
  "Outside the county? Request your area": "¿Está fuera del condado? Solicite su área",
  "What we're building": "Lo que estamos creando",
  "Vehicle help, without the runaround.": "Ayuda para su vehículo, sin complicaciones.",
  "We're starting with seven practical service categories so the first launch stays useful and easier to operate well.": "Comenzamos con siete categorías prácticas para que el primer lanzamiento sea útil y más fácil de operar bien.",
  "Battery & Jump Start": "Batería y arranque",
  "Get back on the road when your battery lets you down.": "Vuelva a la carretera cuando falle la batería.",
  "Tire Help": "Ayuda con llantas",
  "Flat tire support, spare installation, and mobile tire service.": "Ayuda con llantas ponchadas, instalación del repuesto y servicio móvil.",
  "Basic Vehicle Diagnostics": "Diagnóstico básico del vehículo",
  "Connect with a local independent provider for a basic on-site vehicle assessment.": "Conéctese con un proveedor independiente local para una evaluación básica del vehículo.",
  "Window Tint Quotes": "Cotizaciones de polarizado",
  "Request quotes from local tint providers for installations that follow applicable state and local laws.": "Solicite cotizaciones de proveedores locales para instalaciones que cumplan las leyes estatales y locales aplicables.",
  "Rain Guards & Vent Visors": "Deflectores de lluvia y viseras",
  "Request installation of vehicle-fit rain guards, vent visors, or window deflectors.": "Solicite la instalación de deflectores de lluvia, viseras o deflectores de ventana compatibles con el vehículo.",
  "Vehicle Sunshades": "Parasoles para vehículos",
  "Request installation of a removable or retractable sunshade made to fit your vehicle.": "Solicite la instalación de un parasol removible o retráctil compatible con su vehículo.",
  "Car Washing & Detailing": "Lavado y detallado",
  "Choose an exterior wash with basic rim cleaning, interior detailing, or both.": "Elija lavado exterior con limpieza básica de rines, detallado interior o ambos.",
  "Post this job": "Publicar este trabajo",
  "Quote-only service": "Servicio de cotización",
  "Need an estimate for a dent, scratch, or paintwork?": "¿Necesita una cotización para una abolladura, rayón o pintura?",
  "Request a cosmetic-repair quote from a qualified local provider. Final pricing may require photos or an in-person inspection.": "Solicite una cotización de reparación estética a un proveedor local calificado. El precio final puede requerir fotos o una inspección en persona.",
  "Request a quote": "Solicitar cotización",
  "Post the work. Let providers respond.": "Publique el trabajo. Deje que respondan los proveedores.",
  "We're starting with a request-and-quote model while the local provider network grows.": "Comenzamos con un modelo de solicitudes y cotizaciones mientras crece la red local de proveedores.",
  "Post your job": "Publique su trabajo",
  "Tell us about your vehicle, what you need, and your preferred timing.": "Cuéntenos sobre su vehículo, lo que necesita y el horario que prefiere.",
  "Receive quotes": "Reciba cotizaciones",
  "Interested local providers review the details and send a price.": "Los proveedores locales interesados revisan los detalles y envían un precio.",
  "Choose what works": "Elija lo que más le convenga",
  "Compare your options and accept a quote only when it feels right.": "Compare sus opciones y acepte una cotización solo cuando le convenga.",
  "Verified customer reviews": "Reseñas verificadas de clientes",
  "See how local providers performed.": "Vea cómo trabajaron los proveedores locales.",
  "Verified completed job": "Trabajo completado verificado",
  "Tuveloz verified": "Verificado por Tuveloz",
  "No public reviews yet.": "Aún no hay reseñas públicas.",
  "Verified reviews will appear after customers complete jobs.": "Las reseñas verificadas aparecerán después de que los clientes completen trabajos.",
  "New and growing": "Nuevo y en crecimiento",
  "Post your job. We'll send it to providers who match.": "Publique su trabajo. Lo enviaremos a proveedores compatibles.",
  "Tuveloz reviews each request before sharing it with eligible local providers. Because our network is new, getting a quote may take longer at first. Response times should improve as more providers join.": "Tuveloz revisa cada solicitud antes de compartirla con proveedores locales elegibles. Como nuestra red es nueva, recibir una cotización puede tardar más al principio. Los tiempos de respuesta deberían mejorar a medida que se unan más proveedores.",
  "Our vision": "Nuestra visión",
  "We want to change how the mechanic industry works: give customers clearer choices and help independent providers grow.": "Queremos cambiar la manera en que funciona la industria de la mecánica: ofrecer opciones más claras a los clientes y ayudar a crecer a los proveedores independientes.",
  "No payment required to post": "No se requiere pago para publicar",
  "Approved jobs reach matching providers": "Los trabajos aprobados llegan a proveedores compatibles",
  "You choose whether to accept a quote": "Usted decide si acepta una cotización",
  "Your request is in review.": "Su solicitud está en revisión.",
  "If it matches our pilot services and areas, we'll send it to eligible local providers. Tuveloz is new, so quotes may take longer while our network grows. Thank you for your patience.": "Si coincide con nuestros servicios y áreas piloto, la enviaremos a proveedores locales elegibles. Tuveloz es nuevo, por lo que las cotizaciones pueden tardar más mientras crece nuestra red. Gracias por su paciencia.",
  "View your private request": "Ver su solicitud privada",
  "Post another job": "Publicar otro trabajo",
  "Once approved, your request reaches eligible providers.": "Una vez aprobada, su solicitud llega a proveedores elegibles.",
  "Your name": "Su nombre",
  "Email address": "Correo electrónico",
  "Pilot service area": "Área de servicio piloto",
  "Select one": "Seleccione una",
  "City, town, or municipality": "Ciudad o municipio",
  "ZIP code": "Código postal",
  "What does your vehicle need?": "¿Qué necesita su vehículo?",
  "Choose one or more. One provider must be able to handle the complete request.": "Elija uno o más. Un solo proveedor debe poder completar toda la solicitud.",
  "Battery or jump start": "Batería o arranque",
  "Flat-tire help or spare installation": "Ayuda con llanta ponchada o instalación del repuesto",
  "Basic vehicle diagnostics": "Diagnóstico básico del vehículo",
  "Minor dent repair quote": "Cotización de reparación de abolladura menor",
  "Scratch or paintwork quote": "Cotización de rayón o pintura",
  "Window tint installation quote": "Cotización de instalación de polarizado",
  "Rain guard / vent visor installation": "Instalación de deflector de lluvia o visera",
  "Vehicle sunshade installation": "Instalación de parasol para vehículo",
  "Waterless exterior wash": "Lavado exterior sin agua",
  "Exterior wash with water": "Lavado exterior con agua",
  "Interior detailing": "Detallado interior",
  "Rain guards also include vent visors and window deflectors. Sunshades are removable or retractable accessories; window tint is a separate service.": "Los deflectores de lluvia también incluyen viseras y deflectores de ventana. Los parasoles son accesorios removibles o retráctiles; el polarizado es un servicio separado.",
  "Who should supply any needed parts?": "¿Quién debe proporcionar las piezas necesarias?",
  "Providers bring the tools and equipment needed for the job. Any special equipment or rental cost must be disclosed in the quote.": "Los proveedores llevan las herramientas y el equipo necesarios para el trabajo. Cualquier equipo especial o costo de alquiler debe indicarse en la cotización.",
  "Compare parts before you decide": "Compare las piezas antes de decidir",
  "See current OEM and aftermarket listings before choosing whether you or the provider should supply the parts.": "Vea listados actuales de piezas OEM y alternativas antes de decidir si usted o el proveedor proporcionará las piezas.",
  "I already have the parts": "Ya tengo las piezas",
  "I have the parts — labor only": "Tengo las piezas — solo mano de obra",
  "Provider supplies the parts": "El proveedor proporciona las piezas",
  "Provider supplies parts": "El proveedor proporciona las piezas",
  "Either is okay": "Cualquiera está bien",
  "Parts preference": "Preferencia de piezas",
  "No preference": "Sin preferencia",
  "OEM": "OEM",
  "Aftermarket": "Alternativa",
  "Best value": "Mejor valor",
  "If the provider supplies parts, the quote will show separate labor and parts charges before you choose.": "Si el proveedor suministra las piezas, la cotización mostrará por separado los cargos de mano de obra y piezas antes de que usted elija.",
  "Where can the service happen?": "¿Dónde puede realizarse el servicio?",
  "Choose one or both.": "Elija una o ambas opciones.",
  "Provider comes to me": "El proveedor viene a mí",
  "I can go to the provider": "Puedo ir al proveedor",
  "I can go to the provider's business": "Puedo ir al negocio del proveedor",
  "Service address": "Dirección del servicio",
  "Only the provider you select will receive this address.": "Solo el proveedor que seleccione recibirá esta dirección.",
  "Describe the job": "Describa el trabajo",
  "Include a budget here only if you want providers to see one.": "Incluya aquí un presupuesto solo si desea que los proveedores lo vean.",
  "Photo of the issue": "Foto del problema",
  "(optional)": "(opcional)",
  "JPG, PNG, or WebP · maximum 8 MB. Don't upload payment details or sensitive documents.": "JPG, PNG o WebP · máximo 8 MB. No cargue datos de pago ni documentos confidenciales.",
  "Saving…": "Guardando…",
  "Posting…": "Publicando…",
  "Sending…": "Enviando…",
  "Post this job?": "¿Publicar este trabajo?",
  "Review the information above. Nothing is posted until you confirm.": "Revise la información anterior. Nada se publicará hasta que confirme.",
  "Confirm and post": "Confirmar y publicar",
  "Send this feedback?": "¿Enviar esta opinión?",
  "Review your feedback above. It is not sent until you confirm.": "Revise su opinión anterior. No se enviará hasta que confirme.",
  "Confirm and send": "Confirmar y enviar",
  "Submit request": "Enviar solicitud",
  "Book again": "Reservar de nuevo",
  "Request": "Solicitar",
  "again": "de nuevo",
  "again?": "de nuevo?",
  "Want to hire": "¿Quiere contratar a",
  "After Tuveloz reviews the request, it will go only to this provider. Availability and a new quote are not guaranteed.": "Después de que Tuveloz revise la solicitud, se enviará solo a este proveedor. La disponibilidad y una nueva cotización no están garantizadas.",
  "Compare all matching providers instead": "Comparar todos los proveedores compatibles",
  "Which vehicle is this for?": "¿Para qué vehículo es?",
  "Use the same vehicle": "Usar el mismo vehículo",
  "Choose a different vehicle": "Elegir otro vehículo",
  "Real completed-job data": "Datos reales de trabajos completados",
  "Observed Tuveloz price guide": "Guía de precios observados en Tuveloz",
  "Not a promised quote": "No es una cotización prometida",
  "Checking completed Tuveloz jobs…": "Revisando trabajos completados en Tuveloz…",
  "Average": "Promedio",
  "Observed range": "Rango observado",
  "completed jobs": "trabajos completados",
  "Not enough real completed jobs yet to publish a trustworthy price.": "Aún no hay suficientes trabajos reales completados para publicar un precio confiable.",
  "Numbers appear only after at least 3 real, non-test, completed single-service jobs. Combined jobs may price differently.": "Los números aparecen solo después de al menos 3 trabajos reales, no de prueba, completados y de un solo servicio. Los trabajos combinados pueden tener precios diferentes.",
  "We use this information only to review your request and contact you about Tuveloz. Don't include payment details or sensitive documents.": "Usamos esta información solo para revisar su solicitud y comunicarnos con usted sobre Tuveloz. No incluya datos de pago ni documentos confidenciales.",
  "Your feedback matters": "Su opinión es importante",
  "Help us improve Tuveloz": "Ayúdenos a mejorar Tuveloz",
  "Tell us which jobs to add and what would make Tuveloz better for customers and providers.": "Díganos qué trabajos debemos agregar y qué haría que Tuveloz fuera mejor para clientes y proveedores.",
  "Help shape what Tuveloz builds next": "Ayude a definir lo próximo que creará Tuveloz",
  "Choose the services, customer improvements, and provider tools you want us to add as Tuveloz grows.": "Elija los servicios, las mejoras para clientes y las herramientas para proveedores que desea que agreguemos a medida que Tuveloz crece.",
  "Suggest services": "Sugiera servicios",
  "Request provider tools": "Solicite herramientas para proveedores",
  "Improve customer choices": "Mejore las opciones de los clientes",
  "Future expansion": "Expansión futura",
  "Bring Tuveloz to your area.": "Lleve Tuveloz a su área.",
  "Tuveloz currently operates only in Montgomery County, Maryland. Customers and providers elsewhere in Maryland or Washington, DC can request their area. We'll use combined demand to choose where to launch next.": "Tuveloz opera actualmente solo en el Condado de Montgomery, Maryland. Los clientes y proveedores de otras áreas de Maryland o Washington, DC pueden solicitar su área. Usaremos la demanda combinada para decidir dónde lanzar próximamente.",
  "Customers": "Clientes",
  "Providers": "Proveedores",
  "Mobile mechanics & service trucks": "Mecánicos móviles y camiones de servicio",
  "Request your area": "Solicite su área",
  "Four quick answers help us measure real local demand.": "Cuatro respuestas rápidas nos ayudan a medir la demanda local real.",
  "Provider type": "Tipo de proveedor",
  "Mobile mechanic or service truck": "Mecánico móvil o camión de servicio",
  "Shop-based mechanic": "Mecánico con taller",
  "Mobile detailer": "Detallador móvil",
  "Window tint provider": "Proveedor de polarizado",
  "Other vehicle-service provider": "Otro proveedor de servicios para vehículos",
  "State or district": "Estado o distrito",
  "County or independent city": "Condado o ciudad independiente",
  "Your area request is counted.": "Su solicitud de área ha sido contada.",
  "We'll compare customer and provider demand as Tuveloz plans its next launch area.": "Compararemos la demanda de clientes y proveedores mientras Tuveloz planifica su próxima área de lanzamiento.",
  "Request another area": "Solicitar otra área",
  "Request my area": "Solicitar mi área",
  "An area request shows interest; it does not promise a launch date. Don't include payment details or sensitive information.": "Una solicitud de área muestra interés; no promete una fecha de lanzamiento. No incluya datos de pago ni información confidencial.",
  "Choose whether you are a customer, provider, or both.": "Elija si es cliente, proveedor o ambos.",
  "Choose the type of provider you are.": "Elija el tipo de proveedor que es.",
  "Enter your county or city and choose Maryland or Washington, DC.": "Ingrese su condado o ciudad y elija Maryland o Washington, DC.",
  "Tuveloz already serves Montgomery County. Use the customer or provider form to get started.": "Tuveloz ya presta servicio en el Condado de Montgomery. Use el formulario de cliente o proveedor para comenzar.",
  "Enter a Montgomery County ZIP code, or request your area for future expansion.": "Ingrese un código postal del Condado de Montgomery o solicite su área para una futura expansión.",
  "We could not save your area request. Please try again.": "No pudimos guardar su solicitud de área. Inténtelo de nuevo.",
  "This service area cannot accept provider applications until its state and local requirements are reviewed.": "Esta área no puede aceptar solicitudes de proveedores hasta que se revisen sus requisitos estatales y locales.",
  "This provider cannot be verified until the state and local requirements for every service area are reviewed.": "Este proveedor no puede verificarse hasta que se revisen los requisitos estatales y locales de cada área de servicio.",
  "Suggest jobs and services": "Sugiera trabajos y servicios",
  "Tell us what providers need": "Díganos qué necesitan los proveedores",
  "Shape the customer experience": "Ayude a crear la experiencia del cliente",
  "Thanks for your feedback.": "Gracias por su opinión.",
  "We saved your ideas for review as Tuveloz grows.": "Guardamos sus ideas para revisarlas a medida que Tuveloz crece.",
  "Send another response": "Enviar otra respuesta",
  "I am a…": "Soy…",
  "I'm answering as": "Respondo como",
  "Customer": "Cliente",
  "Provider": "Proveedor",
  "Both": "Ambos",
  "Which jobs should Tuveloz add or feature next?": "¿Qué trabajos debería agregar o destacar Tuveloz próximamente?",
  "Select every service you would like to see.": "Seleccione todos los servicios que le gustaría ver.",
  "Oil changes": "Cambios de aceite",
  "Brake service": "Servicio de frenos",
  "Battery replacement": "Reemplazo de batería",
  "Tire installation": "Instalación de llantas",
  "Minor repairs and maintenance": "Reparaciones menores y mantenimiento",
  "Towing or roadside service": "Remolque o asistencia en carretera",
  "Other job or service": "Otro trabajo o servicio",
  "Tell us what should be added": "Díganos qué se debería agregar",
  "Which tools would make a provider's work easier?": "¿Qué herramientas facilitarían el trabajo de un proveedor?",
  "Pick the tools that would genuinely help.": "Elija las herramientas que realmente ayudarían.",
  "Scheduling and availability": "Horarios y disponibilidad",
  "Simple quote templates": "Plantillas sencillas para cotizaciones",
  "Customer messaging": "Mensajes con clientes",
  "Invoices and receipts": "Facturas y recibos",
  "Parts and labor estimates": "Estimaciones de piezas y mano de obra",
  "Business performance dashboard": "Panel de rendimiento del negocio",
  "Other provider tool": "Otra herramienta para proveedores",
  "Suggest another provider feature": "Sugiera otra función para proveedores",
  "What would make Tuveloz better for customers?": "¿Qué haría que Tuveloz fuera mejor para los clientes?",
  "Select the improvements that matter most.": "Seleccione las mejoras que más importan.",
  "Select at least one answer in each feedback section.": "Seleccione al menos una respuesta en cada sección de comentarios.",
  "Clear price ranges": "Rangos de precios claros",
  "Easier provider comparison": "Comparación más sencilla de proveedores",
  "Appointment scheduling": "Programación de citas",
  "Job status updates": "Actualizaciones del estado del trabajo",
  "Service history and reminders": "Historial de servicios y recordatorios",
  "More providers and service choices": "Más proveedores y opciones de servicio",
  "Mobile mechanics, service-truck operators, and shop-based providers can set availability, review matching jobs, send a price, and choose the opportunities that fit their schedule.": "Los mecánicos móviles, los operadores de camiones de servicio y los proveedores con taller pueden definir su disponibilidad, revisar trabajos compatibles, enviar un precio y elegir las oportunidades que se ajusten a su horario.",
  "Other customer improvement": "Otra mejora para clientes",
  "Suggest another improvement": "Sugiera otra mejora",
  "Email (optional)": "Correo electrónico (opcional)",
  "Send feedback": "Enviar opinión",
  "Start with one clear request.": "Comience con una solicitud clara.",
  "A local vehicle-service marketplace built around customer choice.": "Un mercado local de servicios para vehículos creado alrededor de la elección del cliente.",
  "Vehicle services built around customer choice and provider freedom.": "Servicios para vehículos creados alrededor de las opciones del cliente y la libertad del proveedor.",
  "Local marketplace · Operating now in Montgomery County, Maryland.": "Mercado local · Operando ahora en el Condado de Montgomery, Maryland.",
  "Private customer request": "Solicitud privada del cliente",
  "Founding provider workspace": "Espacio del proveedor fundador",
  "Matched job alerts": "Alertas de trabajos compatibles",
  "Your provider workspace.": "Su espacio de proveedor.",
  "Customer contact details appear only after your quote is selected.": "Los datos de contacto del cliente aparecen solo después de que se seleccione su cotización.",
  "Service options:": "Opciones de servicio:",
  "Provider Job Center": "Centro de trabajos del proveedor",
  "Business Page": "Página del negocio",
  "You control the details. Tuveloz keeps every page clean, consistent, and professional.": "Usted controla los detalles. Tuveloz mantiene cada página clara, uniforme y profesional.",
  "Open Jobs": "Trabajos disponibles",
  "Active Jobs": "Trabajos activos",
  "Completed Jobs": "Trabajos completados",
  "Earnings & Hours": "Ingresos y horas",
  "Your business records": "Sus registros del negocio",
  "Time tracking is optional and controlled by you. It is not payroll or employee monitoring.": "El registro de tiempo es opcional y usted lo controla. No es nómina ni monitoreo de empleados.",
  "Job Center": "Centro de trabajos",
  "Active jobs": "Trabajos activos",
  "Keep the customer-visible status and your private work record in one place.": "Mantenga el estado visible para el cliente y su registro privado del trabajo en un solo lugar.",
  "No customer has selected one of your quotes yet.": "Aún ningún cliente ha seleccionado una de sus cotizaciones.",
  "Repeat customer": "Cliente recurrente",
  "Repeat customer request": "Solicitud de cliente recurrente",
  "Private customer contact": "Contacto privado del cliente",
  "Private job tools": "Herramientas privadas del trabajo",
  "Original quote approved": "Cotización original aprobada",
  "Matched alerts": "Alertas compatibles",
  "Open jobs": "Trabajos disponibles",
  "These approved requests match your services, job areas, and meeting options.": "Estas solicitudes aprobadas coinciden con sus servicios, áreas de trabajo y opciones de encuentro.",
  "Checking for matching jobs…": "Buscando trabajos compatibles…",
  "No matching approved jobs are available yet. Check this private link when you receive a new-job alert.": "Aún no hay trabajos aprobados compatibles. Revise este enlace privado cuando reciba una alerta de trabajo nuevo.",
  "Quote submitted": "Cotización enviada",
  "Open for quotes": "Abierto para cotizaciones",
  "Customer issue photo": "Foto del problema del cliente",
  "Quote submitted for customer review.": "Cotización enviada para revisión del cliente.",
  "Your request": "Su solicitud",
  "Compare provider quotes.": "Compare cotizaciones de proveedores.",
  "Service can happen:": "El servicio puede realizarse:",
  "Parts:": "Piezas:",
  "Requested again with:": "Solicitado de nuevo con:",
  "Photo attached to your request": "Foto adjunta a su solicitud",
  "Live job status": "Estado actual del trabajo",
  "Quote accepted": "Cotización aceptada",
  "On my way": "En camino",
  "Arrived": "Llegó",
  "Completed": "Completado",
  "Refresh this private page to see the provider’s latest update.": "Actualice esta página privada para ver la última actualización del proveedor.",
  "Provider completion photo": "Foto de finalización del proveedor",
  "No quotes yet. Check this private link again later.": "Aún no hay cotizaciones. Revise este enlace privado más tarde.",
  "Labor": "Mano de obra",
  "Parts": "Piezas",
  "Total": "Total",
  "Availability:": "Disponibilidad:",
  "Provider options:": "Opciones del proveedor:",
  "Quote selected": "Cotización seleccionada",
  "Your selected provider": "Su proveedor seleccionado",
  "Provider business address:": "Dirección del negocio del proveedor:",
  "Your service address:": "Su dirección de servicio:",
  "Confirm the final meeting place before anyone travels.": "Confirme el lugar final antes de que alguien se traslade.",
  "Start a new request with your contact, vehicle, and location details already filled in. The provider will send a new quote.": "Inicie una nueva solicitud con sus datos de contacto, vehículo y ubicación ya completados. El proveedor enviará una nueva cotización.",
  "Quote passed on": "Cotización descartada",
  "No reason shared": "No se compartió un motivo",
  "Reconsider this quote": "Volver a considerar esta cotización",
  "Another quote was selected.": "Se seleccionó otra cotización.",
  "Quote from": "Cotización de",
  "What this quote includes": "Lo que incluye esta cotización",
  "View provider details": "Ver detalles del proveedor",
  "Confirm this quote?": "¿Confirmar esta cotización?",
  "Confirm quote": "Confirmar cotización",
  "Publish these changes?": "¿Publicar estos cambios?",
  "Save these changes?": "¿Guardar estos cambios?",
  "These changes will appear on your public business page.": "Estos cambios aparecerán en su página pública del negocio.",
  "These changes will be saved to your private draft.": "Estos cambios se guardarán en su borrador privado.",
  "Confirm and publish": "Confirmar y publicar",
  "Confirm and save": "Confirmar y guardar",
  "Replace your logo?": "¿Reemplazar su logotipo?",
  "Add this logo?": "¿Agregar este logotipo?",
  "This image will become your business logo.": "Esta imagen se convertirá en el logotipo de su negocio.",
  "Confirm upload": "Confirmar carga",
  "Add this work photo?": "¿Agregar esta foto de trabajo?",
  "This photo will be added to your customer-facing work gallery.": "Esta foto se agregará a su galería de trabajos visible para los clientes.",
  "Remove this photo?": "¿Eliminar esta foto?",
  "This photo will be removed from your work gallery.": "Esta foto se eliminará de su galería de trabajos.",
  "Confirm removal": "Confirmar eliminación",
  "Removing…": "Eliminando…",
  "Save this job record?": "¿Guardar este registro de trabajo?",
  "Review the hours and notes above before saving this private record.": "Revise las horas y notas anteriores antes de guardar este registro privado.",
  "Confirm and save record": "Confirmar y guardar registro",
  "Go back": "Regresar",
  "Why are you passing?": "¿Por qué la descarta?",
  "This is optional. Tuveloz shows providers only combined feedback so they can improve.": "Esto es opcional. Tuveloz muestra a los proveedores solo comentarios combinados para que puedan mejorar.",
  "Price was too high": "El precio era demasiado alto",
  "I wanted more experience": "Buscaba más experiencia",
  "I preferred another provider": "Preferí otro proveedor",
  "Timing did not work": "El horario no funcionó",
  "Other": "Otro",
  "Pass without sharing a reason": "Descartar sin compartir un motivo",
  "Keep this quote": "Conservar esta cotización",
  "Choose provider": "Elegir proveedor",
  "Not this one": "Este no",
  "Published review": "Reseña publicada",
  "Verified customer review": "Reseña verificada del cliente",
  "Choose 1 to 5 stars": "Elija de 1 a 5 estrellas",
  "Comment": "Comentario",
  "Publish this review?": "¿Publicar esta reseña?",
  "Yes, publish review": "Sí, publicar reseña",
  "Review before publishing": "Revisar antes de publicar",
  "Provider page": "Página del proveedor",
  "This page is not public yet.": "Esta página aún no es pública.",
  "Return to Tuveloz": "Volver a Tuveloz",
  "Loading provider page…": "Cargando página del proveedor…",
  "Customer confidence": "Confianza del cliente",
  "Verified, real information": "Información real y verificada",
  "Only verified Tuveloz information and actual completed-job activity appear here.": "Aquí solo aparece información verificada por Tuveloz y actividad real de trabajos completados.",
  "Verified identity": "Identidad verificada",
  "Test profile": "Perfil de prueba",
  "Provider status checked by Tuveloz.": "Estado del proveedor revisado por Tuveloz.",
  "Completed Tuveloz jobs": "Trabajos completados en Tuveloz",
  "Jobs finished through Tuveloz.": "Trabajos finalizados por medio de Tuveloz.",
  "Verified reviews": "Reseñas verificadas",
  "Provider experience": "Experiencia del proveedor",
  "Not listed yet": "Aún no indicada",
  "Provider-supplied experience.": "Experiencia indicada por el proveedor.",
  "Tuveloz does not estimate missing history. If information is unavailable, we say so.": "Tuveloz no estima el historial faltante. Si la información no está disponible, lo indicamos.",
  "Need vehicle help?": "¿Necesita ayuda con su vehículo?",
  "Post one request and compare clear quotes.": "Publique una solicitud y compare cotizaciones claras.",
  "Contact details stay private until you select a quote.": "Los datos de contacto permanecen privados hasta que seleccione una cotización.",
  "Overview": "Resumen",
  "Work Gallery": "Galería de trabajos",
  "About this provider": "Acerca de este proveedor",
  "Experience": "Experiencia",
  "Based in": "Ubicado en",
  "Availability": "Disponibilidad",
  "Typical hours": "Horario habitual",
  "Meeting options": "Opciones de encuentro",
  "Approved work": "Trabajo aprobado",
  "These are the services Tuveloz has approved this provider to quote.": "Estos son los servicios que Tuveloz ha aprobado para que este proveedor cotice.",
  "Available for customer requests": "Disponible para solicitudes de clientes",
  "Job areas": "Áreas de trabajo",
  "See the work": "Vea el trabajo",
  "Photos are selected and described by the provider.": "Las fotos son seleccionadas y descritas por el proveedor.",
  "Work photos are coming soon.": "Las fotos de trabajos estarán disponibles pronto.",
  "This provider has not added gallery photos yet.": "Este proveedor aún no ha agregado fotos.",
  "Completed-job feedback": "Comentarios de trabajos completados",
  "No reviews yet": "Aún no hay reseñas",
  "No completed-job reviews yet.": "Aún no hay reseñas de trabajos completados.",
  "Only feedback from completed Tuveloz jobs appears here.": "Aquí solo aparecen comentarios de trabajos completados en Tuveloz.",
  "Provider pages show currently eligible service listings, provider-supplied work photos, and completed-job reviews.": "Las páginas de proveedores muestran servicios actualmente elegibles, fotos proporcionadas por el proveedor y reseñas de trabajos completados.",
  "Private coaching": "Orientación privada",
  "Profile health": "Estado del perfil",
  "Live customer preview": "Vista previa para clientes",
  "Updates while you edit": "Se actualiza mientras edita",
  "Your business name": "Nombre de su negocio",
  "Add a clear one-line description of your vehicle services.": "Agregue una descripción clara y breve de sus servicios para vehículos.",
  "Add experience": "Agregue experiencia",
  "Local service area": "Área de servicio local",
  "If approved for publication, customers see currently eligible service listings, provider-supplied work photos, and reviews linked to completed Tuveloz jobs.": "Si se aprueba su publicación, los clientes verán los servicios actualmente elegibles, fotos proporcionadas por el proveedor y reseñas vinculadas a trabajos completados en Tuveloz.",
  "Printable business cards": "Tarjetas de presentación imprimibles",
  "Your unique QR is added automatically": "Su QR único se agrega automáticamente",
  "SCAN MY PAGE": "ESCANEE MI PÁGINA",
  "Services · Work · Reviews": "Servicios · Trabajos · Reseñas",
  "Print 10 business cards": "Imprimir 10 tarjetas",
  "Creates a standard US Letter sheet with ten 3.5 × 2 inch cards ready to print and cut.": "Crea una hoja tamaño Carta de EE. UU. con diez tarjetas de 3.5 × 2 pulgadas listas para imprimir y cortar.",
  "Publish your approved profile to create your cards.": "Publique su perfil aprobado para crear sus tarjetas.",
  "Your permanent QR will be placed on every card automatically.": "Su QR permanente se colocará automáticamente en cada tarjeta.",
  "Opening a print-ready sheet with 10 business cards.": "Abriendo una hoja lista para imprimir con 10 tarjetas.",
  "This score is based on profile completeness only. It does not affect rankings or customer access.": "Esta puntuación se basa únicamente en qué tan completo está el perfil. No afecta las clasificaciones ni el acceso de los clientes.",
  "Next improvements": "Próximas mejoras",
  "Simple ways to strengthen your page": "Formas sencillas de fortalecer su página",
  "Add a short headline that tells customers what you do.": "Agregue un título corto que indique a los clientes lo que hace.",
  "Explain your specialties and what customers can expect.": "Explique sus especialidades y lo que los clientes pueden esperar.",
  "Add your years of experience.": "Agregue sus años de experiencia.",
  "Add a current availability note.": "Agregue una nota de disponibilidad actual.",
  "List your normal business hours.": "Indique su horario habitual.",
  "Add a logo or clear business image.": "Agregue un logotipo o una imagen clara del negocio.",
  "Add at least one genuine work photo.": "Agregue al menos una foto real de su trabajo.",
  "Publish your profile when the details are ready.": "Publique su perfil cuando los datos estén listos.",
  "Your profile is complete. Keep your availability and work photos current.": "Su perfil está completo. Mantenga actualizadas su disponibilidad y sus fotos de trabajo.",
  "Your vehicle": "Su vehículo",
  "Choose the easiest way to identify it.": "Elija la forma más fácil de identificarlo.",
  "VIN lookup": "Búsqueda por VIN",
  "Recommended": "Recomendado",
  "Year, make & model": "Año, marca y modelo",
  "Year": "Año",
  "Make": "Marca",
  "Model": "Modelo",
  "Select year": "Seleccione el año",
  "Select make": "Seleccione la marca",
  "My make is not listed": "Mi marca no aparece",
  "Choose year and make first": "Primero elija el año y la marca",
  "Loading confirmed models…": "Cargando modelos confirmados…",
  "Select model": "Seleccione el modelo",
  "My model is not listed": "Mi modelo no aparece",
  "Exact trim": "Versión exacta",
  "I'm not sure of the trim": "No estoy seguro de la versión",
  "Motor / engine configuration": "Configuración del motor",
  "Choose model first": "Primero elija el modelo",
  "Loading official options…": "Cargando opciones oficiales…",
  "Select motor / engine": "Seleccione el motor",
  "I'm not sure": "No estoy seguro",
  "My motor / engine is not listed": "Mi motor no aparece",
  "Type the motor / engine": "Escriba el motor",
  "This typed value overrides the official choice and is marked customer-entered for provider verification.": "Este valor escrito reemplaza la opción oficial y se marca como ingresado por el cliente para que el proveedor lo verifique.",
  "Choose an official option above or type the engine here from the vehicle badge or records.": "Elija una opción oficial arriba o escriba aquí el motor usando la insignia o los registros del vehículo.",
  "Type it only if the vehicle badge or records provide it, or leave it blank.": "Escríbalo solo si la insignia o los registros del vehículo lo indican, o déjelo en blanco.",
  "This typed value overrides the VIN or official choice and is marked customer-entered for provider verification.": "Este valor escrito reemplaza el VIN o la opción oficial y se marca como ingresado por el cliente para que el proveedor lo verifique.",
  "Keep the VIN result above or type a correction from the vehicle badge or records.": "Conserve el resultado del VIN de arriba o escriba una corrección usando la insignia o los registros del vehículo.",
  "Motor/engine not provided": "Motor no proporcionado",
  "Options come from official vehicle data. Tap one only if it matches your vehicle.": "Las opciones provienen de datos oficiales del vehículo. Toque una solo si coincide con su vehículo.",
  "No confirmed motor / engine choice was returned.": "No se encontró una opción confirmada de motor.",
  "Type it below only if you know it, or leave it blank.": "Escríbalo abajo solo si lo sabe o déjelo en blanco.",
  "This will be marked as customer-entered so a provider knows to verify it.": "Se marcará como dato ingresado por el cliente para que el proveedor sepa que debe verificarlo.",
  "17-character VIN": "VIN de 17 caracteres",
  "Find vehicle": "Buscar vehículo",
  "Finding…": "Buscando…",
  "VIN decoded by NHTSA": "VIN decodificado por NHTSA",
  "Review the details before continuing.": "Revise los datos antes de continuar.",
  "Vehicle selected": "Vehículo seleccionado",
  "Home": "Inicio",
  "Workspace help": "Ayuda de acceso",
  "Private Tuveloz access": "Acceso privado de Tuveloz",
  "Your workspace stays on Tuveloz.": "Su espacio de trabajo permanece en Tuveloz.",
  "Customers and approved providers use private Tuveloz links. No outside account or extra password is required.": "Los clientes y proveedores aprobados usan enlaces privados de Tuveloz. No se requiere una cuenta externa ni otra contraseña.",
  "Customer access": "Acceso para clientes",
  "Keep your request link.": "Guarde el enlace de su solicitud.",
  "After you post a job, Tuveloz opens your private request page. Use that link to review provider quotes and job updates.": "Después de publicar un trabajo, Tuveloz abre la página privada de su solicitud. Use ese enlace para revisar cotizaciones y actualizaciones.",
  "Review quotes and job updates": "Revise cotizaciones y actualizaciones",
  "Choose the provider that works for you": "Elija el proveedor que le convenga",
  "Book the same provider again": "Vuelva a reservar con el mismo proveedor",
  "Provider access": "Acceso para proveedores",
  "Use your provider workspace link.": "Use el enlace de su espacio de proveedor.",
  "Tuveloz gives approved providers a private workspace link for matching jobs, quotes, schedules, and business tools.": "Tuveloz da a los proveedores aprobados un enlace privado para trabajos compatibles, cotizaciones, horarios y herramientas de negocio.",
  "Matching jobs, quotes, and schedule": "Trabajos compatibles, cotizaciones y horario",
  "Business page and work gallery": "Página de negocio y galería de trabajos",
  "QR code and printable business cards": "Código QR y tarjetas de presentación imprimibles",
  "Apply to join": "Solicitar unirse",
  "Need your private link again?": "¿Necesita nuevamente su enlace privado?",
  "Email us from the same address used for your request or provider application so we can verify and help you.": "Escríbanos desde la misma dirección usada en su solicitud de cliente o proveedor para que podamos verificarla y ayudarle.",
  "Email Tuveloz": "Escribir a Tuveloz",
  "Keep every private link to yourself. Anyone with the link can open that workspace.": "Mantenga cada enlace privado solo para usted. Cualquier persona con el enlace puede abrir ese espacio.",
  "Save this private link. It opens your request details and quotes.": "Guarde este enlace privado. Abre los detalles y las cotizaciones de su solicitud.",
  "Sign in": "Iniciar sesión",
  "Sign up / Sign in": "Crear cuenta / Iniciar sesión",
  "Customer account": "Cuenta de cliente",
  "Provider account": "Cuenta de proveedor",
  "Account": "Cuenta",
  "Tuveloz sign in": "Inicio de sesión de Tuveloz",
  "Welcome to Tuveloz.": "Bienvenido a Tuveloz.",
  "Access your customer requests, provider application, or approved-provider workspace.": "Acceda a sus solicitudes de cliente, su solicitud de proveedor o su espacio de proveedor aprobado.",
  "Verified provider": "Proveedor verificado",
  "Customer workspace": "Espacio del cliente",
  "Verified provider workspace": "Espacio del proveedor verificado",
  "Customer sign in": "Inicio de sesión del cliente",
  "Open your requests and quotes.": "Abra sus solicitudes y cotizaciones.",
  "Open your jobs and business tools.": "Abra sus trabajos y herramientas de negocio.",
  "Use the same email address you entered when posting a job.": "Use el mismo correo que ingresó al publicar un trabajo.",
  "Provider applicants can sign in to complete onboarding. Approved providers can also open their workspace here.": "Los solicitantes de proveedor pueden iniciar sesión para completar la incorporación. Los proveedores aprobados también pueden abrir aquí su espacio.",
  "Create an account.": "Cree una cuenta.",
  "Reset your password.": "Restablezca su contraseña.",
  "Use an email code.": "Use un código por correo.",
  "We'll email a code to verify your address.": "Le enviaremos un código para verificar su correo.",
  "We'll verify your email before changing your password.": "Verificaremos su correo antes de cambiar su contraseña.",
  "We'll send a 6-digit code that expires in 10 minutes.": "Enviaremos un código de 6 dígitos que vence en 10 minutos.",
  "Create account": "Crear cuenta",
  "Password": "Contraseña",
  "Forgot password?": "¿Olvidó su contraseña?",
  "Email me a one-time code instead": "Enviarme un código de un solo uso",
  "Create password": "Crear contraseña",
  "New password": "Nueva contraseña",
  "Confirm password": "Confirmar contraseña",
  "15 characters minimum. Spaces are allowed.": "Mínimo 15 caracteres. Se permiten espacios.",
  "Send verification code": "Enviar código de verificación",
  "Back to sign in": "Volver al inicio de sesión",
  "6-digit verification code": "Código de verificación de 6 dígitos",
  "Reset password": "Restablecer contraseña",
  "Start over": "Empezar de nuevo",
  "Email me a sign-in code": "Enviarme un código de inicio",
  "Back to password sign in": "Volver al inicio con contraseña",
  "6-digit sign-in code": "Código de inicio de sesión de 6 dígitos",
  "Use a different email": "Usar otro correo",
  "Passwords are securely hashed. Email codes expire in 10 minutes and can be used once.": "Las contraseñas se protegen con un hash seguro. Los códigos por correo vencen en 10 minutos y se pueden usar una sola vez.",
  "New provider? Verification starts with an application.": "¿Es un proveedor nuevo? La verificación comienza con una solicitud.",
  "Your requests, without the provider clutter.": "Sus solicitudes, sin herramientas innecesarias de proveedor.",
  "Review quotes, follow job progress, and start your next vehicle-service request.": "Revise cotizaciones, siga el progreso del trabajo e inicie su próxima solicitud de servicio.",
  "Switch": "Cambiar",
  "Sign out": "Cerrar sesión",
  "Customer requests": "Solicitudes del cliente",
  "My jobs": "Mis trabajos",
  "No requests yet": "Aún no hay solicitudes",
  "Your vehicle-service requests will appear here.": "Sus solicitudes de servicio aparecerán aquí.",
  "Customer tools": "Herramientas del cliente",
  "Everything in one place.": "Todo en un solo lugar.",
  "Compare verified-provider quotes": "Compare cotizaciones de proveedores verificados",
  "See the 10% service fee before choosing": "Vea la tarifa de servicio del 10% antes de elegir",
  "Track an accepted job's progress": "Siga el progreso de un trabajo aceptado",
  "Book a completed provider again": "Vuelva a reservar con un proveedor anterior",
  "Providers never see your exact address or contact details until you select their quote.": "Los proveedores no ven su dirección exacta ni sus datos de contacto hasta que usted elige su cotización.",
  "Provider sign in": "Inicio de proveedor",
  "Your provider quote remains your full subtotal. Tuveloz adds a separate 10% service fee to the customer's total.": "Su cotización de proveedor permanece como su subtotal completo. Tuveloz agrega una tarifa separada del 10% al total del cliente.",
  "Provider quote subtotal": "Subtotal de la cotización",
  "Tuveloz service fee (10%)": "Tarifa de servicio de Tuveloz (10%)",
  "Customer total": "Total del cliente",
  "A 10% customer service fee is shown before you confirm": "Se muestra una tarifa de servicio del 10% antes de confirmar",
  "Accepted service fees": "Tarifas de servicio aceptadas",
};

const spanishPlaceholders: Record<string, string> = {
  "Full name": "Nombre completo",
  "Example: Rockville or Silver Spring": "Ejemplo: Rockville o Silver Spring",
  "Example: Prince George's County": "Ejemplo: Condado de Prince George",
  "Street address": "Dirección",
  "Describe the problem, condition, preferred timing, and anything else the provider should know.": "Describa el problema, la condición, el horario preferido y cualquier otra información que el proveedor deba saber.",
  "Tell us what is difficult about finding or providing vehicle services today.": "Díganos qué es difícil al buscar u ofrecer servicios para vehículos.",
  "Type the exact make": "Escriba la marca exacta",
  "Type the exact model": "Escriba el modelo exacto",
  "Use the vehicle badge or records": "Use la insignia o los registros del vehículo",
  "Example: 2.0L turbo": "Ejemplo: turbo de 2.0 L",
  "Enter VIN": "Ingrese el VIN",
  "Tell other customers about the service you received.": "Cuente a otros clientes sobre el servicio que recibió.",
  "Profile health score": "Puntuación del estado del perfil",
};

type TextState = { source: string; applied: string };
const textStates = new WeakMap<Text, TextState>();
const attributeStates = new WeakMap<Element, Map<string, TextState>>();

function translatedPattern(value: string) {
  let match = value.match(/^(\d+) completed-job (review|reviews)$/);
  if (match) return `${match[1]} ${match[2] === "review" ? "reseña" : "reseñas"} de trabajos completados`;
  match = value.match(/^(\d+) currently listed (service|services)$/);
  if (match) return `${match[1]} ${match[2] === "service" ? "servicio actualmente publicado" : "servicios actualmente publicados"}`;
  match = value.match(/^(\d+) currently listed vehicle services$/);
  if (match) return `${match[1]} servicios para vehículos actualmente publicados`;
  return value;
}

function translatedValue(source: string, attribute = false) {
  const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return source;
  const [, before, core, after] = match;
  const dictionary = attribute ? spanishPlaceholders : spanishText;
  return `${before}${dictionary[core] ?? translatedPattern(core)}${after}`;
}

function ignored(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(
    "script, style, [data-language-control], [data-no-interface-translation], [data-manual-language]",
  ));
}

function translateTextNode(node: Text, language: SiteLanguage) {
  if (ignored(node) || !node.nodeValue?.trim()) return;
  const current = node.nodeValue;
  const previous = textStates.get(node);
  const source = previous && (current === previous.applied || current === previous.source)
    ? previous.source
    : current;
  const applied = language === "es" ? translatedValue(source) : source;
  textStates.set(node, { source, applied });
  if (current !== applied) node.nodeValue = applied;
}

function translateAttribute(element: Element, attribute: string, language: SiteLanguage) {
  if (ignored(element)) return;
  const current = element.getAttribute(attribute);
  if (!current) return;
  const states = attributeStates.get(element) ?? new Map<string, TextState>();
  const previous = states.get(attribute);
  const source = previous && (current === previous.applied || current === previous.source)
    ? previous.source
    : current;
  const applied = language === "es" ? translatedValue(source, true) : source;
  states.set(attribute, { source, applied });
  attributeStates.set(element, states);
  if (current !== applied) element.setAttribute(attribute, applied);
}

function translateInterface(root: ParentNode, language: SiteLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text, language);
    current = walker.nextNode();
  }
  root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((element) => {
    translateAttribute(element, "placeholder", language);
    translateAttribute(element, "title", language);
    translateAttribute(element, "aria-label", language);
  });
}

function getLanguageSnapshot(): SiteLanguage {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(LANGUAGE_KEY) === "es" ? "es" : "en";
}

function subscribeLanguage(listener: () => void) {
  const handle = () => listener();
  window.addEventListener("storage", handle);
  window.addEventListener(LANGUAGE_EVENT, handle);
  return () => {
    window.removeEventListener("storage", handle);
    window.removeEventListener(LANGUAGE_EVENT, handle);
  };
}

function setStoredLanguage(language: SiteLanguage) {
  window.localStorage.setItem(LANGUAGE_KEY, language);
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

const SiteLanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
}>({
  language: "en",
  setLanguage: () => undefined,
});

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<SiteLanguage>(
    subscribeLanguage,
    getLanguageSnapshot,
    (): SiteLanguage => "en",
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "es"
      ? "Tuveloz | Ayuda vehicular local"
      : "Tuveloz | Simple, Local Vehicle Help";
    translateInterface(document.body, language);
    const observer = new MutationObserver(() => {
      window.queueMicrotask(() => translateInterface(document.body, language));
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });
    return () => observer.disconnect();
  }, [language]);

  return (
    <SiteLanguageContext.Provider value={{ language, setLanguage: setStoredLanguage }}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage() {
  return useContext(SiteLanguageContext);
}

export function SiteLanguageButton() {
  const { language, setLanguage } = useSiteLanguage();
  const nextLanguage = language === "en" ? "es" : "en";

  return (
    <button
      aria-label={language === "en" ? "Cambiar toda la página a español" : "Change the whole page to English"}
      className="site-language-button"
      data-language-control
      onClick={() => setLanguage(nextLanguage)}
      type="button"
    >
      <span aria-hidden="true">🌐</span>
      <strong>{language === "en" ? "Español" : "English"}</strong>
    </button>
  );
}
