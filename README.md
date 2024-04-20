# Gerador de metadata para o OHIF Viewer

Esta extensão gera o arquivo de metadados para permitir a visualização do exame no OHIF Viewer.

## Função

generateMetadata(studyDirectory, urlPrefix, outputPath,shouldReturnAsText=true,shouldDeleteDICOMFolder=false)

## Parâmetros

| Parâmetros | Detalhes |
| ------ | ------ |
| studyDirectory | Deve ser informado o caminho onde estão as imagens DICOM do exame. |
| urlPrefix | Deve ser informado o caminho onde estão as imagens DICOM. |
| outputPath | Deve ser informado o caminho onde o arquivo de metadata deve ser salvo. |
| shouldReturnAsText | Caso este parâmetro esteja preenchido como true, ao final da geração do arquivo de metadata, é retornado o conteúdo dele no formato texto. Caso esteja preenchido como false, é retornado o buffer. |
| shouldDeleteDICOMFolder | Caso este parâmetro esteja preenchido como true, ao final da geração do arquivo de metadados, a pasta onde está o exame DICOM é deletada. |

## Instalação

```sh
npm install ohif-metadata
```