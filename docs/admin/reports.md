# Relatórios administrativos

O primeiro relatório exporta sessões de recarga em CSV UTF-8. O endpoint exige
`reports.export`, filtra pelo tenant e seleciona no máximo 10.000 registros.
Datas são ISO-8601 UTC, energia usa kWh e valores monetários seguem o formato
documentado no cabeçalho.

O download usa access token em memória e não cria URL pública. Toda evolução
deve registrar filtros, operador e correlation ID na auditoria.

Para volumes maiores, o caminho aprovado é um job assíncrono tenant-scoped com
arquivo criptografado, expiração curta e autorização no download. Não se deve
aumentar indefinidamente o limite síncrono nem carregar o dataset no navegador.
