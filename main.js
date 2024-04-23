const args=process.argv.slice(2)
const { spawn } = require('child_process')
const fs = require('fs')

function generateMetadata_v3_7(studyDirectory, urlPrefix, outputPath,shouldReturnAsText=true,shouldDeleteDICOMFolder=false){

    return generate(
        './node_modules/ohif-metadata/dicom-json-generator.js',
        studyDirectory,
        urlPrefix,
        outputPath,
        shouldReturnAsText,
        shouldDeleteDICOMFolder
    )

}

async function generate(script,studyDirectory, urlPrefix, outputPath,shouldReturnAsText,shouldDeleteDICOMFolder) {

  deleteMetadata(outputPath)

  const command = './node_modules/ohif-metadata/node'
  const type = shouldReturnAsText ? 'utf8' : null

  const args = [
    script,
    studyDirectory,
    urlPrefix,
    outputPath,
  ]

  const childProcess = spawn(command, args)

  childProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`)
  })

  childProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`)
  })

  childProcess.on('close', (code) => {
    console.log(`processo filho encerrado com código ${code}`)
  })

  return new Promise((resolve, reject) => {
    childProcess.on('close', (code) => {
      console.log(`processo filho encerrado com código ${code}`)
      if (code === 0) {
        // Arquivo gerado com sucesso, então lemos o arquivo e retornamos seu conteúdo
        fs.promises.readFile(outputPath,type)
          .then((data) => {

            if(shouldDeleteDICOMFolder)
              deleteFolder(studyDirectory) 
                    
            resolve(data)   
          })
          .catch((error) => {
            reject(new Error(`Erro ao ler arquivo de metadados: ${error.message}`))
          })
      } else {
        // Caso contrário, rejeitamos a Promise
        reject(new Error(`Erro ao gerar DICOM. Código de saída: ${code}`))
      }
    })
  })
}

async function deleteMetadata(filePath){
  try {
      fs.access(filePath, fs.constants.F_OK, (err) => {
      // Excluir o arquivo se ele existir
      if (!err) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.log('Erro ao excluir o arquivo:', err)
            return
          }
          console.log('Arquivo excluído com sucesso!')
        })
      } else {
        console.log('O arquivo não existe.')
      }
    })
    
  } catch (error) {
    console.log('Erro : ', error)
  }
}

async function deleteFolder(folderPath) {
    console.log(folderPath)
    try {
        // Deletar a pasta e tudo o que estiver dentro dela
        fs.rmdirSync(folderPath, { recursive: true })
        console.log(`Pasta ${folderPath} e seu conteúdo foram deletados com sucesso.`)
    } catch (err) {
        console.error(`Erro ao deletar a pasta ${folderPath}:`, err)
    }
}

module.exports = {
  generateMetadata_v3_7
}