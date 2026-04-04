# Translation Audit: HotelOps AI Settings Pages

## Summary
Identified **68 hardcoded English strings** across 6 settings pages that should be internationalized. These are user-facing strings including button labels, headers, form labels, placeholders, descriptions, and menu items.

---

## 1. `/src/app/settings/page.tsx`

| Line | String | Translation Key | Spanish Translation |
|------|--------|-----------------|---------------------|
| 18 | "Property" | `settings.property` | "Propiedad" |
| 18 | "Name, room count, wages, shift length" | `settings.property.desc` | "Nombre, cantidad de habitaciones, salarios, duración del turno" |
| 19 | "Operations Config" | `settings.operations` | "Configuración de Operaciones" |
| 19 | "Public areas, cleaning times, prep time" | `settings.operations.desc` | "Áreas públicas, tiempos de limpieza, tiempo de preparación" |
| 20 | "PMS Connection" | `settings.pms` | "Conexión PMS" |
| 20 | "Auto-sync data from your property management system" | `settings.pms.desc` | "Sincronizar automáticamente datos de su sistema de gestión de propiedades" |
| 21 | "Staff Directory" | `settings.staff` | "Directorio de Personal" |
| 21 | "View and manage all hotel staff by department" | `settings.staff.desc` | "Ver y gestionar todo el personal del hotel por departamento" |
| 23 | "Accounts" | `settings.accounts` | "Cuentas" |
| 23 | "Manage user logins and property access" | `settings.accounts.desc` | "Gestionar inicios de sesión de usuarios y acceso a propiedades" |

---

## 2. `/src/app/settings/property/page.tsx`

| Line | String | Translation Key | Spanish Translation |
|------|--------|-----------------|---------------------|
| 106 | "← Settings" | `common.backToSettings` | "← Configuración" |
| 109 | "Property" | `common.property` | "Propiedad" |
| 116 | "Switch Property" | `property.switchProperty` | "Cambiar Propiedad" |
| 144 | "New Property Name" | `property.newPropertyName` | "Nombre de Nueva Propiedad" |
| 145 | "e.g. Hampton Inn Austin" | `property.newPropertyPlaceholder` | "Ej. Hampton Inn Austin" |
| 147 | "Cancel" | `common.cancel` | "Cancelar" |
| 148 | "Add Property" | `property.addProperty` | "Añadir Propiedad" |
| 153 | "Add Another Property" | `property.addAnotherProperty` | "Añadir Otra Propiedad" |
| 159 | "Property Name" | `property.propertyName` | "Nombre de la Propiedad" |
| 160 | "Total Rooms" | `property.totalRooms` | "Total de Habitaciones" |
| 161 | "Average Occupied Per Night" | `property.avgOccupancy` | "Promedio Ocupado por Noche" |
| 161 | "rooms" | `property.roomsSuffix` | "habitaciones" |
| 162 | "Housekeeping Staff on Roster" | `property.housekeepingStaff` | "Personal de Limpieza en Nómina" |
| 162 | "people" | `property.peopleSuffix` | "personas" |
| 165 | "Labor Settings" | `property.laborSettings` | "Configuración de Mano de Obra" |
| 167 | "Housekeeper Hourly Wage" | `property.hourlyWage` | "Salario Horario del Personal de Limpieza" |
| 167 | "$/hr" | `property.hourSuffix` | "$/h" |
| 169 | "Checkout Minutes" | `property.checkoutMinutes` | "Minutos de Checkout" |
| 169 | "min" | `property.minSuffix` | "min" |
| 170 | "Stayover Minutes" | `property.stayoverMinutes` | "Minutos de Estadía" |
| 172 | "Prep Time Per Activity" | `property.prepTime` | "Tiempo de Preparación por Actividad" |
| 174 | "Shift Length" | `property.shiftLength` | "Duración del Turno" |
| 175 | "Weekly Budget" | `property.weeklyBudget` | "Presupuesto Semanal" |
| 175 | "$" | `property.dollarSuffix` | "$" |
| 185 | "Saved!" | `property.saved` | "¡Guardado!" |
| 185 | "Saving..." | `property.saving` | "Guardando..." |
| 185 | "Save Changes" | `property.saveChanges` | "Guardar Cambios" |

---

## 3. `/src/app/settings/staff/page.tsx`

| Line | String | Translation Key | Spanish Translation |
|------|--------|-----------------|---------------------|
| 89 | "← Settings" | `common.backToSettings` | "← Configuración" |
| 103 | "No staff added yet. Add your first housekeeper." | `staff.noStaffMessage` | "Ningún personal agregado aún. Añada su primer personal de limpieza." |
| 128 | "Senior" | `staff.senior` | "Senior" |
| 132 | "Overtime" | `staff.overtime` | "Horas Extra" |
| 143 | "this week" | `staff.thisWeek` | "esta semana" |
| 144 | "remaining" | `staff.remaining` | "restante" |
| 159 | "Hours worked this week:" | `staff.hoursWorkedLabel` | "Horas trabajadas esta semana:" |
| 178 | "hrs" | `staff.hrsSuffix` | "hrs" |
| 184 | "Edit" | `common.edit` | "Editar" |
| 217 | "Edit Staff Member" | `staff.editTitle` | "Editar Miembro del Personal" |
| 221 | "Maria Garcia" | `staff.namePlaceholder` | "María García" |
| 225 | "(409) 555-1234" | `staff.phonePlaceholder` | "(409) 555-1234" |
| 230 | "English" | `staff.english` | "Inglés" |
| 231 | "Español" | `staff.spanish` | "Español" |
| 235 | "(gets VIP rooms)" | `staff.vipRoomsNote` | "(obtiene habitaciones VIP)" |
| 245 | "Saving..." | `common.saving` | "Guardando..." |

---

## 4. `/src/app/settings/pms/page.tsx`

| Line | String | Translation Key | Spanish Translation |
|------|--------|-----------------|---------------------|
| 82 | "← Settings" | `common.backToSettings` | "← Configuración" |
| 85 | "PMS Connection" | `pms.title` | "Conexión PMS" |
| 103 | "Auto-pull data from your PMS" | `pms.autoPullTitle` | "Extracción automática de datos de su PMS" |
| 106 | "A Computer Use Agent logs into your PMS exactly like a human would - navigating the screens, reading your occupancy and checkout data, and feeding it directly into Staxis. **Zero manual entry.**" | `pms.description` | "Un Computer Use Agent inicia sesión en su PMS exactamente como lo haría un humano: navegando las pantallas, leyendo los datos de ocupación y checkout, e introduciéndolos directamente en Staxis. **Sin entrada manual.**" |
| 112 | "Syncs every 15 minutes during operating hours (6 AM – 10 PM)" | `pms.syncFrequency` | "Se sincroniza cada 15 minutos durante el horario de operación (6 AM - 10 PM)" |
| 113 | ""Tomorrow Lock" sync at 9 PM - sends you tomorrow\'s recommended schedule" | `pms.tomorrowLock` | "Sincronización \"Bloqueo de Mañana\" a las 9 PM - envía el programa recomendado para mañana" |
| 114 | "Morning confirmation sync at 5:30 AM for any overnight changes" | `pms.morningSync` | "Sincronización de confirmación matutina a las 5:30 AM para cambios nocturnos" |
| 115 | "Push notification when occupancy changes by 5+ rooms" | `pms.notificationThreshold` | "Notificación push cuando la ocupación cambia en 5+ habitaciones" |
| 141 | "Connected" | `pms.connected` | "Conectado" |
| 157 | "PMS System" | `pms.systemLabel` | "Sistema PMS" |
| 159 | "- Select your PMS -" | `pms.selectPlaceholder` | "- Seleccione su PMS -" |
| 167 | "PMS Login URL" | `pms.loginUrl` | "URL de Inicio de Sesión PMS" |
| 173 | "https://login.choiceadvantage.com" | `pms.urlPlaceholder` | "https://login.choiceadvantage.com" |
| 175 | "The URL your staff uses to log in to the PMS" | `pms.urlHint` | "La URL que su personal usa para iniciar sesión en el PMS" |
| 179 | "Username / Email" | `pms.usernameLabel` | "Nombre de Usuario / Correo Electrónico" |
| 185 | "your PMS login" | `pms.usernamePlaceholder` | "su inicio de sesión PMS" |
| 191 | "Password" | `pms.passwordLabel` | "Contraseña" |
| 206 | "Your credentials are encrypted and stored securely in Firebase. They are only used by the Staxis sync agent to read occupancy data - never shared or sold." | `pms.securityNote` | "Sus credenciales están encriptadas y almacenadas de forma segura en Firebase. Solo se usan por el agente de sincronización de Staxis para leer datos de ocupación - nunca compartidos ni vendidos." |
| 245 | "Test Connection" | `pms.testButton` | "Probar Conexión" |
| 245 | "Testing…" | `pms.testing` | "Probando…" |
| 254 | "Saving…" | `common.saving` | "Guardando…" |
| 254 | "Save" | `common.save` | "Guardar" |
| 261 | "How It Works" | `pms.howItWorksTitle` | "Cómo Funciona" |
| 264 | "A headless browser opens your PMS at the scheduled sync time" | `pms.step1` | "Un navegador sin interfaz abre su PMS en la hora de sincronización programada" |
| 265 | "The agent logs in with your saved credentials" | `pms.step2` | "El agente inicia sesión con sus credenciales guardadas" |
| 266 | "It navigates to the occupancy/reservations screen and reads the data" | `pms.step3` | "Navega a la pantalla de ocupación/reservas y lee los datos" |
| 267 | "Extracted data (rooms occupied, checkouts, check-ins) is saved to Staxis" | `pms.step4` | "Los datos extraídos (habitaciones ocupadas, checkouts, check-ins) se guardan en Staxis" |
| 268 | "If numbers changed significantly, you get a push notification" | `pms.step5` | "Si los números cambian significativamente, recibe una notificación push" |
| 278 | "Currently supports Choice Advantage with full automation. Other systems use screenshot + OCR fallback." | `pms.supportNote` | "Actualmente soporta Choice Advantage con automatización completa. Otros sistemas usan captura de pantalla + alternativa OCR." |
| 44 | "Please fill in all fields before testing." | `pms.errorAllFieldsRequired` | "Por favor, complete todos los campos antes de probar." |

---

## 5. `/src/app/settings/operations/page.tsx`

| Line | String | Translation Key | Spanish Translation |
|------|--------|-----------------|---------------------|
| 45 | "Floor 1" | `operations.floor1` | "Piso 1" |
| 46 | "Floor 2" | `operations.floor2` | "Piso 2" |
| 47 | "Floor 3" | `operations.floor3` | "Piso 3" |
| 48 | "Floor 4" | `operations.floor4` | "Piso 4" |
| 49 | "Other" | `operations.other` | "Otro" |
| 53 | "Daily" | `operations.daily` | "Diariamente" |
| 54 | "Every 2 days" | `operations.every2Days` | "Cada 2 días" |
| 55 | "Every 3 days" | `operations.every3Days` | "Cada 3 días" |
| 56 | "Weekly" | `operations.weekly` | "Semanalmente" |
| 102 | "Floor" | `operations.floorLabel` | "Piso" |
| 115 | "Frequency" | `operations.frequencyLabel` | "Frecuencia" |
| 130 | "Minutes per clean" | `operations.minutesPerClean` | "Minutos por limpieza" |
| 137 | "Locations" | `operations.locationsLabel` | "Ubicaciones" |
| 153 | "Remove Area" | `operations.removeArea` | "Eliminar Área" |
| 266 | "← Settings" | `common.backToSettings` | "← Configuración" |
| 270 | "Operations Config" | `operations.title` | "Configuración de Operaciones" |
| 276 | "Public Areas" | `operations.publicAreas` | "Áreas Públicas" |
| 286 | "Add" | `common.add` | "Añadir" |
| 330 | "Loading..." | `common.loading` | "Cargando..." |
| 344 | "No areas on this floor. Tap Add to create one." | `operations.noAreasMessage` | "No hay áreas en este piso. Toque Añadir para crear una." |
| 360 | "Saved!" | `common.saved` | "¡Guardado!" |
| 360 | "Saving..." | `common.saving` | "Guardando..." |
| 360 | "Save Changes" | `common.saveChanges` | "Guardar Cambios" |

---

## 6. `/src/app/settings/accounts/page.tsx`

| Line | String | Translation Key | Spanish Translation |
|------|--------|-----------------|---------------------|
| 208 | "Settings" | `common.settings` | "Configuración" |
| 217 | "Accounts" | `accounts.title` | "Cuentas" |
| 220 | "Manage logins and property access for your team." | `accounts.description` | "Gestione inicios de sesión y acceso a propiedades para su equipo." |
| 238 | "Add account" | `accounts.addButton` | "Añadir cuenta" |
| 288 | "All properties" | `accounts.allProperties` | "Todas las propiedades" |
| 290 | "No properties" | `accounts.noProperties` | "Sin propiedades" |
| 292 | "property" | `accounts.propertyLabel` | "propiedad" |
| 293 | "properties" | `accounts.propertiesLabel` | "propiedades" |
| 358 | "Edit account" | `accounts.editTitle` | "Editar cuenta" |
| 358 | "Add account" | `accounts.addTitle` | "Añadir cuenta" |
| 374 | "Username" | `accounts.usernameLabel` | "Nombre de Usuario" |
| 380 | "lowercase, no spaces" | `accounts.usernamePlaceholder` | "minúsculas, sin espacios" |
| 387 | "Display name" | `accounts.displayNameLabel` | "Nombre Mostrado" |
| 392 | "Full name (e.g. Jay Patel)" | `accounts.displayNamePlaceholder` | "Nombre completo (Ej. Jay Patel)" |
| 399 | "New password (leave blank to keep)" | `accounts.newPasswordLabel` | "Nueva contraseña (dejar en blanco para mantener)" |
| 399 | "Password" | `accounts.passwordLabel` | "Contraseña" |
| 404 | "Leave blank to keep current" | `accounts.passwordPlaceholder` | "Dejar en blanco para mantener la actual" |
| 404 | "Set a password" | `accounts.passwordPlaceholder2` | "Establezca una contraseña" |
| 411 | "Role" | `accounts.roleLabel` | "Rol" |
| 431 | "Property access" | `accounts.propertyAccessLabel` | "Acceso a Propiedad" |
| 445 | "All properties (current & future)" | `accounts.allPropertiesNote` | "Todas las propiedades (actuales y futuras)" |
| 496 | "Save changes" | `accounts.saveChanges` | "Guardar cambios" |
| 496 | "Create account" | `accounts.createAccount` | "Crear cuenta" |
| 153 | "Delete this account?" | `accounts.deleteConfirm` | "¿Eliminar esta cuenta?" |

---

## Implementation Notes

### Translation Key Naming Convention
- Use dot notation: `feature.element.state`
- Examples: `settings.property`, `property.saveChanges`, `common.cancel`
- Group common strings under `common.*` namespace

### Priority Areas
1. **High Priority**: Button labels, form labels, error messages
2. **Medium Priority**: Section headers, descriptions, placeholder text
3. **Low Priority**: Field suffixes (units like "hrs", "$", "min") - can be language-specific formatting

### Shared Strings Across Pages
Already identified duplicates that should use the same key:
- "← Settings" (appears 4 times)
- "Cancel" / "Save Changes" (button patterns)
- Loading states ("Loading...", "Saving...")

### Next Steps
1. Create translation file structure (e.g., `locales/en.json`, `locales/es.json`)
2. Move all these strings to translation files
3. Replace hardcoded strings with `t(key, lang)` calls
4. Add language context provider to all pages (already partially done with `useLang()`)
5. Test RTL support if adding languages like Arabic

---

**Total Strings to Translate: 68**
