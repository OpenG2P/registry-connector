{{- define "registry-connector.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "registry-connector.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "registry-connector.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "registry-connector.labels" -}}
app.kubernetes.io/name: {{ include "registry-connector.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "registry-connector.selectorLabels" -}}
app.kubernetes.io/name: {{ include "registry-connector.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "registry-connector.serviceAccountName" -}}
{{- printf "%s-sa" (include "registry-connector.fullname" .) -}}
{{- end -}}

{{- define "registry-connector.image" -}}
{{- printf "%s:%s" .Values.image.repository .Values.image.tag -}}
{{- end -}}

{{- define "registry-connector.dbName" -}}
{{- tpl .Values.global.connectorDB . -}}
{{- end -}}

{{- define "registry-connector.dbUser" -}}
{{- tpl .Values.global.connectorDBUser . -}}
{{- end -}}

{{- define "registry-connector.dbSecret" -}}
{{- tpl .Values.global.connectorDBSecret . -}}
{{- end -}}

{{- define "registry-connector.dbPasswordKey" -}}
{{- tpl .Values.global.connectorDBUserPasswordKey . -}}
{{- end -}}

{{- define "registry-connector.partnerBaseUrl" -}}
{{- printf "http://%s.%s.svc.cluster.local" .Values.global.partnerApiService .Release.Namespace -}}
{{- end -}}

{{- define "registry-connector.postgresWaitArgs" -}}
- -c
- >-
  until PGPASSWORD="${CONNECTOR_DB_PASSWORD}" psql -q
  -U "${CONNECTOR_DB_USERNAME}"
  -h "${CONNECTOR_DB_HOSTNAME}"
  -p "${CONNECTOR_DB_PORT:-5432}"
  -d "${CONNECTOR_DB_DBNAME}"
  -c "SELECT 1" >/dev/null 2>&1;
  do echo "waiting for postgres credentials to work..."; sleep 3; done
{{- end -}}

{{- define "registry-connector.commonEnv" -}}
- name: CONNECTOR_DB_DRIVER
  value: {{ .Values.commonEnv.CONNECTOR_DB_DRIVER | quote }}
- name: CONNECTOR_DB_HOSTNAME
  value: {{ .Values.global.postgresqlHost | quote }}
- name: CONNECTOR_DB_PORT
  value: {{ .Values.global.postgresqlPort | quote }}
- name: CONNECTOR_DB_USERNAME
  value: {{ include "registry-connector.dbUser" . | quote }}
- name: CONNECTOR_DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "registry-connector.dbSecret" . | quote }}
      key: {{ include "registry-connector.dbPasswordKey" . | quote }}
- name: CONNECTOR_DB_DBNAME
  value: {{ include "registry-connector.dbName" . | quote }}
- name: CONNECTOR_PARTNER_INGEST_BASE_URL
  value: {{ include "registry-connector.partnerBaseUrl" . | quote }}
- name: CONNECTOR_CELERY_BROKER_URL
  value: {{ printf "redis://%s:%v/%v" .Values.global.redisHost .Values.global.redisPort .Values.global.redisDb | quote }}
- name: CONNECTOR_CELERY_RESULT_BACKEND
  value: {{ printf "redis://%s:%v/%v" .Values.global.redisHost .Values.global.redisPort .Values.global.redisDb | quote }}
- name: CONNECTOR_LOG_LEVEL
  value: {{ .Values.commonEnv.CONNECTOR_LOG_LEVEL | quote }}
- name: CONNECTOR_STORE_RUN_PAYLOADS
  value: {{ .Values.commonEnv.CONNECTOR_STORE_RUN_PAYLOADS | quote }}
- name: CONNECTOR_STRICT_INCREMENTAL
  value: {{ .Values.commonEnv.CONNECTOR_STRICT_INCREMENTAL | quote }}
- name: CONNECTOR_FULL_SCAN_ON_INCREMENTAL_UNSUPPORTED
  value: {{ .Values.commonEnv.CONNECTOR_FULL_SCAN_ON_INCREMENTAL_UNSUPPORTED | quote }}
- name: CONNECTOR_METRICS_ENABLED
  value: {{ .Values.commonEnv.CONNECTOR_METRICS_ENABLED | quote }}
- name: CONNECTOR_CORS_ORIGINS
  value: {{ .Values.commonEnv.CONNECTOR_CORS_ORIGINS | quote }}
{{- if .Values.global.metadataDsnSecret }}
- name: CONNECTOR_MASTER_DATA_DB_DSN
  valueFrom:
    secretKeyRef:
      name: {{ .Values.global.metadataDsnSecret | quote }}
      key: {{ .Values.global.masterDataDsnKey | quote }}
- name: CONNECTOR_REGISTRY_DB_DSN
  valueFrom:
    secretKeyRef:
      name: {{ .Values.global.metadataDsnSecret | quote }}
      key: {{ .Values.global.registryDsnKey | quote }}
{{- end }}
{{- end -}}
