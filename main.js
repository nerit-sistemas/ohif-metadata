const args=process.argv.slice(2)
const { spawn } = require('child_process')
const fs = require('fs')

/**
 *  =================================================================================================
 *  =========== ANTES DE LER ESSE CÓDIGO, É IMPORTANTE QUE LEIA O ARQUIVO README.md ANTES ===========
 *  =================================================================================================
 *  https://github.com/nerit-sistemas/ohif-metadata
 */

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

  /**
   * Verificamos se a pasta na qual vamos gerar o metadata.json já existe. 
   * Caso exista, verificamos se dentro dela há o arquivo metadata.json. 
   * Se existir, deletamos porque vamos criar um novo.
   */
  deleteMetadata(outputPath)

  //Montamos o comando para executar o Node 16, já que pode haver algum projeto usando uma versão anterior do Node.
  const command = './node_modules/ohif-metadata/node'
  const type = shouldReturnAsText ? 'utf8' : null

  //Preparamos os argumentos para a execução do arquivo dicom-json-generator.js.
  const args = [
    script, //Este argumento receberá o arquivo dicom-json-generator.js.
    studyDirectory, //Este argumento receberá o local onde os arquivos DICOM serão salvos.
    urlPrefix, //Este argumento é onde apontaremos os arquivos DICOM no metadata.json.
    outputPath, //Este argumento receberá o local onde o arquivo metadata.json será salvo.
  ]

  /**
   * https://www.npmjs.com/package/spawn
   * Importando o módulo child_process, que fornece a funcionalidade para criar processos secundários (filhos)
   */
  const childProcess = spawn(command, args)

  // Configurando um ouvinte de eventos para o stdout do processo filho
  childProcess.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`)
  })

  // Configurando um ouvinte de eventos para o stderr do processo filho
  childProcess.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`)
  })

  // Configurando um ouvinte de eventos para o fechamento do processo filho
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

//Exclui o arquivo metadata.json caso ele exista.
async function deleteMetadata(filePath){

  try {

    fs.access(filePath, fs.constants.F_OK, (err) => {

        // Excluir o arquivo se ele existir
        if (!err) {
          fs.unlink(filePath, (err) => {
            if (err) {
              console.log(`Erro ao excluir o arquivo ${filePath}:`, err)
              return
            }
            console.log('Arquivo excluído com sucesso!')
          })
        } 

    })
    
  } catch (error) {
    console.log('Erro : ', error)
  }

}

// Exclui as pastas dos exames que criamos para gerar o metadata.json.
async function deleteFolder(folderPath) {

    try {
        // Deleta a pasta e tudo o que estiver dentro dela
        fs.rmdirSync(folderPath, { recursive: true })
        console.log(`Pasta ${folderPath} e seu conteúdo foram deletados com sucesso.`)
    } catch (err) {
        console.error(`Erro ao deletar a pasta ${folderPath}:`, err)
    }

}

module.exports = {
  generateMetadata_v3_7
}