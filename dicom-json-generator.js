/*
 * This script uses nodejs to generate a JSON file from a DICOM study folder.
 * You need to have dcmjs installed in your project.
 * The JSON file can be used to load the study into the OHIF Viewer. You can get more detail
 * in the DICOM JSON Data source on docs.ohif.org
 *
 * Usage: node dicomStudyToJSONLaunch.js <studyFolder> <urlPrefix> <outputJSONPath>
 *
 * params:
 * - studyFolder: path to the study folder
 * - urlPrefix: prefix to the url that will be used to load the study into the viewer. For instance
 *   we use https://ohif-assets.s3.us-east-2.amazonaws.com/dicom-json/data as the urlPrefix for the
 *   example since the data is hosted on S3 and each study is in a folder. So the url in the generated
 *   json file for the first instance of the first series of the first study will be
 *   dicomweb:https://ohif-assets.s3.us-east-2.amazonaws.com/dicom-json/data/Series1/Instance1
 * - outputJSONPath: path to the output JSON file
 */

const { convertDICOMToJSONThroughFile } = require('./dicom-json-lib')

const args = process.argv.slice(2);
const [studyDirectory, urlPrefix, outputPath] = args;

if (args.length !== 3) {
  console.error(
    'Usage: node dicomStudyToJSONLaunch.js <studyFolder> <urlPrefix> <outputJSONPath>',
  );
  process.exit(1);
}

convertDICOMToJSONThroughFile(studyDirectory, urlPrefix, outputPath);
