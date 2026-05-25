import { useState, useEffect } from 'react';
import { useFetcher } from 'react-router';
import type { TravelRoute } from '~/shared/types/TravelRoute';
import type { FormData } from '~/shared/types/FormData';
import type { DepartmentData } from '~/shared/types/DepartmentData';
import RouteInputGroup from '~/shared/ui/RouteInputGroup';
import Toast from '~/shared/ui/Toast';
import Button from '~/shared/ui/Button';

interface Props {
  data?: FormData;
  mode: 'create' | 'edit' | 'draft';
  role?: string;
  /**
   * Centro de costos cargado por el loader de la route padre. Todas las rutas
   * (crear/editar/completar) lo proveen — sin fetch interno.
   */
  costCenter?: DepartmentData | null;
}

type SubmitIntent = 'create' | 'create-draft' | 'edit' | 'confirm';
type FetcherResult =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: string; code?: string };

const emptyRoute: TravelRoute = {
  router_index: 0,
  origin_country_name: '',
  origin_city_name: '',
  destination_country_name: '',
  destination_city_name: '',
  beginning_date: '',
  beginning_time: '',
  ending_date: '',
  ending_time: '',
  plane_needed: false,
  hotel_needed: false
};

const initialFormState: FormData = {
  ...emptyRoute,
  notes: '',
  requested_fee: '',
  imposed_fee: 0,
  routes: [{ ...emptyRoute, router_index: 0 }],
};

export default function TravelRequestForm({ data, mode, role, costCenter }: Props) {
  const [deptData] = useState<DepartmentData | null>(costCenter ?? null);
  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [disabledButton, setDisabledButton] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [displayFee, setDisplayFee] = useState<string>('');
  const fetcher = useFetcher<FetcherResult>();

  const inputStyle = 'border border-gray-300 p-2 rounded w-full bg-white';
  useEffect(() => {
    if (data) {
      const transformedRoutes = data.routes.map((route: any) => ({
        ...route,
        origin_country_name: route.origin_country,
        origin_city_name: route.origin_city,
        destination_country_name: route.destination_country,
        destination_city_name: route.destination_city,
      }));
      const newData = {
        ...data,
        routes: transformedRoutes,
      };
      setFormData(newData);
      
      // Init display fee
      if (newData.requested_fee && newData.requested_fee !== 0) {
        const val = parseFloat(newData.requested_fee as string);
        if (!isNaN(val)) {
          setDisplayFee(`$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        }
      }
    }
  }, [data]);

  // Reacción al resultado de cualquier mutación RR7 (create/draft/edit/confirm).
  useEffect(() => {
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    if (fetcher.data.ok) {
      setToast({ message: 'Operación realizada exitosamente.', type: 'success' });
      const redirectTo = fetcher.data.redirectTo
        ?? (role === 'Solicitante' ? '/dashboard' : '/solicitudes-autorizador');
      setTimeout(() => {
        window.location.href = redirectTo;
      }, 1500);
    } else {
      const errorMsg = fetcher.data.error ?? 'Hubo un error al procesar la solicitud.';
      setError(errorMsg);
      setToast({ message: errorMsg, type: 'error' });
    }
  }, [fetcher.state, fetcher.data, role]);

  const handleRouteUpdate = (index: number, name: string, value: any) => {
    setError(null)
    setFormData((prev) => {
      const updatedRoutes = prev.routes.map((route, i) => {
        if (i === index) {
          return {
            ...route,
            [name]: value
          };
        }
        return route;
      });
      return { ...prev, routes: updatedRoutes };
    });
  };

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setError(null)
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addRoute = () => {
    setFormData((prev) => ({
      ...prev,
      routes: [...prev.routes, { ...emptyRoute, router_index: prev.routes.length }]
    }));
  };

  const removeRoute = (indexToRemove: number) => {
    setFormData((prev) => {
      const filteredRoutes = prev.routes.filter((_, i) => i !== indexToRemove);
      const reindexedRoutes = filteredRoutes.map((route, i) => ({
        ...route,
        router_index: i,
      }));
      return { ...prev, routes: reindexedRoutes };
    });
  };

  // --- Date and Time Validation Logic ---
  const validateRoutes = (): string | null => {
    const today = new Date();
    // Set today to the start of the day (00:00:00) for accurate date-only comparison
    today.setHours(0, 0, 0, 0); 

    for (const [idx, route] of formData.routes.entries()) {
      // Validate that date strings are not empty before creating Date objects
      if (!route.beginning_date || !route.ending_date) {
        return `Ruta #${idx + 1}: Las fechas de inicio y fin son obligatorias.`;
      }

      const beginningDate = new Date(route.beginning_date);
      const endingDate = new Date(route.ending_date);

      // Check if Date objects are valid (e.g., handles malformed date strings if not caught by input type="date")
      if (isNaN(beginningDate.getTime()) || isNaN(endingDate.getTime())) {
        return `Ruta #${idx + 1}: Formato de fecha inválido. Por favor, utiliza el formato MM/DD/YYYY.`;
      }

      // 1. Check if beginning_date is in the past
      // Compare normalized dates to ignore time component
      const beginningDateOnly = new Date(beginningDate.getFullYear(), beginningDate.getMonth(), beginningDate.getDate());
      if (beginningDateOnly < today) {
        return `Ruta #${idx + 1}: La fecha de inicio (${route.beginning_date}) no puede ser una fecha pasada.`;
      }

      // 2. Check if ending_date is before beginning_date
      // Compare normalized dates for initial check
      const endingDateOnly = new Date(endingDate.getFullYear(), endingDate.getMonth(), endingDate.getDate());
      if (endingDateOnly < beginningDateOnly) {
        return `Ruta #${idx + 1}: La fecha de fin (${route.ending_date}) debe ser igual o posterior a la fecha de inicio (${route.beginning_date}).`;
      }
      
      // 3. If dates are the same, check times
      if (endingDateOnly.getTime() === beginningDateOnly.getTime()) {
        if (!route.beginning_time || !route.ending_time) {
          return `Ruta #${idx + 1}: Las horas de inicio y fin son obligatorias cuando las fechas son las mismas.`;
        }

        // Parse hours and minutes
        const [bh, bm] = route.beginning_time.split(':').map(Number);
        const [eh, em] = route.ending_time.split(':').map(Number);
        
        const beginningMinutes = bh * 60 + bm;
        const endingMinutes = eh * 60 + em;

        if (endingMinutes <= beginningMinutes) { // Use <= to enforce "posterior" (strictly after)
          return `Ruta #${idx + 1}: La hora de fin (${route.ending_time}) debe ser posterior a la hora de inicio (${route.beginning_time}) cuando las fechas son las mismas.`;
        }
      }
    }
    return null; // No errors found
  };
  // --- End Date and Time Validation Logic ---

  const handleSetToast = (message: string, type: 'success' | 'error', duration: number = 2000) => {
    setDisabledButton(true)
    setToast({ message, type });
    //setTimeout(() => setError(null), duration);
    setTimeout(() => {
      setToast(null);
      setDisabledButton(false);
    }, duration);
  };

  // Construye el body snake_case que consumen los mappers de las actions RR7.
  const buildBody = () => {
    const firstRoute = formData.routes[0];
    const additionalRoutes = formData.routes
      .slice(1)
      .map((route, idx) => ({ ...route, router_index: idx + 1 }))
      .filter((route) =>
        route.origin_country_name ||
        route.origin_city_name ||
        route.destination_country_name ||
        route.destination_city_name ||
        route.beginning_date ||
        route.beginning_time ||
        route.ending_date ||
        route.ending_time ||
        route.plane_needed ||
        route.hotel_needed,
      );
    return {
      router_index: firstRoute.router_index,
      notes: typeof formData.notes === 'string' ? formData.notes.trim() : '',
      requested_fee: parseFloat(formData.requested_fee as string) || 0,
      imposed_fee: 0,
      origin_country_name: firstRoute.origin_country_name,
      origin_city_name: firstRoute.origin_city_name,
      destination_country_name: firstRoute.destination_country_name,
      destination_city_name: firstRoute.destination_city_name,
      beginning_date: firstRoute.beginning_date,
      beginning_time: firstRoute.beginning_time,
      ending_date: firstRoute.ending_date,
      ending_time: firstRoute.ending_time,
      plane_needed: firstRoute.plane_needed,
      hotel_needed: firstRoute.hotel_needed,
      additionalRoutes,
    };
  };

  const submitIntent = (intent: SubmitIntent) => {
    const fd = new globalThis.FormData();
    fd.set('intent', intent);
    fd.set('body', JSON.stringify(buildBody()));
    fetcher.submit(fd, { method: 'post' });
  };

  // Validación estricta (todos los campos requeridos del primer tramo + notas + cuota).
  const validateStrict = (): string | null => {
    const routeError = validateRoutes();
    if (routeError) return routeError;
    const firstRoute = formData.routes[0];
    const missing =
      !firstRoute.origin_country_name ||
      !firstRoute.origin_city_name ||
      !firstRoute.destination_country_name ||
      !firstRoute.destination_city_name ||
      !firstRoute.beginning_date ||
      !firstRoute.beginning_time ||
      !firstRoute.ending_date ||
      !firstRoute.ending_time ||
      !formData.requested_fee ||
      !formData.notes;
    if (missing) {
      return 'Por favor, completa todos los campos requeridos de forma correcta antes de enviar la solicitud.';
    }
    return null;
  };

  // create (Enviar) + confirm draft (Enviar): validación estricta.
  const handleStrictSubmit = (intent: 'create' | 'confirm') => {
    const err = validateStrict();
    if (err) {
      setError(err);
      handleSetToast(err, 'error');
      return;
    }
    setError(null);
    submitIntent(intent);
  };

  // create-draft (Guardar Borrador) + edit save-changes (Guardar Cambios):
  // validación laxa — guarda lo que haya, avisa si hay fechas inválidas.
  const handleLooseSubmit = (intent: 'create-draft' | 'edit') => {
    const routeError = validateRoutes();
    if (routeError) {
      handleSetToast(routeError + ' Los campos válidos se guardarán.', 'error', 4000);
    }
    setError(null);
    submitIntent(intent);
  };

  // edit (Actualizar, mode='edit'): validación estricta.
  const handleEditSubmit = () => {
    const err = validateStrict();
    if (err) {
      setError(err);
      handleSetToast(err, 'error');
      return;
    }
    setError(null);
    submitIntent('edit');
  };

  // Dispatcher del submit del <form> (Enter): acción primaria según modo.
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') return handleStrictSubmit('create');
    if (mode === 'edit') return handleEditSubmit();
    return handleStrictSubmit('confirm');
  };

  const handleResetForm = () => {
    setFormData(initialFormState);
    setError(null);
    setToast(null);
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      {/* Nota de campos obligatorios */}
      <div className="flex items-center bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-500 p-4 rounded shadow-sm mb-4">
        <svg className="w-6 h-6 text-blue-500 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="white" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
        </svg>
        <p className="text-sm text-blue-900 font-medium">
          Los campos obligatorios están marcados con un asterisco.
        </p>
      </div>

      {/* Render all routes dynamically */}
      {formData.routes.map((route, index) => (
        <RouteInputGroup
          key={route.router_index}
          route={route}
          onChange={handleRouteUpdate}
          index={index}
          onRemove={removeRoute}
          isRemovable={formData.routes.length > 1}
        />
      ))}

      {/* Button to add more routes */}
      <div className="flex justify-start mt-6">
        <button
          type="button"
          onClick={addRoute}
          className="bg-blue-600 text-white px-5 py-2 rounded-md shadow-md hover:bg-blue-700 transition-colors"
        >
          + Agregar Ruta a mi Viaje
        </button>
      </div>

      <hr className="my-8 border-gray-300" />

      {/* General Trip Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Detalles Generales del Viaje</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Anticipo Esperado (MXN)<span className="text-red-500"> *</span></label>
          <input 
            name="requested_fee" 
            placeholder="Ej. $15,000.00" 
            type="text" 
            className={inputStyle} 
            value={displayFee} 
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              setFormData(prev => ({...prev, requested_fee: val}));
              setDisplayFee(e.target.value);
            }}
            onBlur={() => {
              const val = parseFloat(formData.requested_fee as string);
              if (!isNaN(val)) {
                 setDisplayFee(`$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
              } else {
                 setDisplayFee('');
              }
            }}
            onFocus={() => {
              setDisplayFee(formData.requested_fee ? String(formData.requested_fee) : '');
            }}
            required 
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Observaciones / Comentarios<span className="text-red-500"> *</span></label>
          <textarea name="notes" rows={4} className="w-full border p-2 rounded-md" value={formData.notes} onChange={handleGeneralChange} required></textarea>
        </div>
      </div>

      {/* Department Info */}
      {deptData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Centro de Costos</label>
            <input
              type="text"
              value={deptData.costs_center}
              disabled
              className="w-full border rounded p-2 bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Departamento</label>
            <input
              type="text"
              value={deptData.department_name}
              disabled
              className="w-full border rounded p-2 bg-gray-100"
            />
          </div>
        </div>
      )}

      {/* Mensaje de Error */}
      { error && (
        <div className="bg-red-200 text-red-800 p-4 rounded-md">
          <p className="text-sm">{error}</p>
        </div>
      )}
      {mode === 'draft' && !error && (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-md">
          <p className="text-sm">Estás editando un borrador. Asegúrate de completar todos los campos antes de enviar.</p>
        </div>
      )}
      {mode === 'edit' && !error && (
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-md">
          <p className="text-sm">Estás editando una solicitud existente. Asegúrate de revisar todos los campos antes de actualizar.</p>
        </div>
      )}
      {mode === 'create' && !error && (
        <div className="bg-blue-100 text-blue-800 p-4 rounded-md">
          <p className="text-sm">Estás creando una nueva solicitud de viaje. Completa todos los campos requeridos.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <Button 
          type="button" 
          onClick={handleResetForm} 
          variant="border"
          color="accent"
          disabled={disabledButton}
        >
          Limpiar Formulario
        </Button>
        {mode == 'create' && (
          <div className='flex gap-3'>
            <Button
              type="button"
              onClick={() => handleLooseSubmit('create-draft')}
              variant="border"
              color="primary"
              disabled={disabledButton || fetcher.state !== 'idle'}
            >
              Guardar Borrador
            </Button>
            <Button
              type="button"
              onClick={() => handleStrictSubmit('create')}
              variant="filled"
              color="success"
              disabled={disabledButton || fetcher.state !== 'idle'}
            >
              Enviar Solicitud
            </Button>
          </div>
        )}
        {mode == 'edit' && (
          <Button
            type="button"
            onClick={handleEditSubmit}
            variant="filled"
            color="primary"
            disabled={disabledButton || fetcher.state !== 'idle'}
          >
            Actualizar Solicitud
          </Button>
        )}
        {mode == 'draft' && (
          <div className='flex gap-3'>
            <Button
              type="button"
              onClick={() => handleLooseSubmit('edit')}
              variant="border"
              color="primary"
              disabled={disabledButton || fetcher.state !== 'idle'}
            >
              Guardar Cambios
            </Button>
            <Button
              type="button"
              onClick={() => handleStrictSubmit('confirm')}
              variant="filled"
              color="success"
              disabled={disabledButton || fetcher.state !== 'idle'}
            >
              Enviar Solicitud
            </Button>
          </div>
        )}
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </form>
  );
}