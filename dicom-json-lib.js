const dcmjs = require("dcmjs");
const path = require("path");
const fs = require("fs").promises;

/**
 * @typedef {Object} PatientName
 * @property {string} Alphabetic - The patient's name in alphabetic format.
 */

/**
 * @typedef {Object} Series
 * @property {Object} metadata - Metadata for the series.
 * @property {string} url - URL link to the DICOM file.
 */

/**
 * @typedef {Object} Study
 * @property {string} StudyInstanceUID - Unique identifier for the study instance.
 * @property {string} StudyDescription - Description of the study.
 * @property {string} StudyDate - Date of the study.
 * @property {string} StudyTime - Time of the study.
 * @property {PatientName[]} PatientName - Array of patient name objects.
 * @property {string} PatientID - Unique identifier for the patient.
 * @property {string} AccessionNumber - Accession number for the study.
 * @property {string} PatientAge - Age of the patient.
 * @property {string} PatientSex - Sex of the patient.
 * @property {?number} PatientWeight - Weight of the patient (nullable).
 * @property {Series[]} series - Array of series objects.
 * @property {number} NumInstances - Number of instances in the study.
 * @property {string} Modalities - Modality used in the study.
 */

/**
 * @typedef {Object} StudiesData
 * @property {Study[]} studies - Array of studies.
 */

/**
 * Converts DICOM files in a study directory to a JSON file.
 *
 * This function reads all DICOM files from the specified study directory,
 * processes each file, and writes the metadata to a JSON file at the specified
 * output path. It excludes files with extensions ".DS_Store" and ".xml".
 *
 * @param {string} studyDirectory - The path to the directory containing DICOM files.
 * @param {string} urlPrefix - The prefix for constructing file URLs in the JSON.
 * @param {string} outputPath - The path where the resulting JSON file will be saved.
 * @returns {Promise<StudiesData>} - A model containing structured study data.
 */
async function convertDICOMToJSONThroughFile(
  studyDirectory,
  urlPrefix,
  outputPath
) {
  /**
   * @type {StudiesData}
   */
  const model = {
    studies: [],
  };

  try {
    const files = await recursiveReadDir(studyDirectory);
    console.debug("Processing...");

    for (const file of files) {
      if (!file.includes(".DS_Store") && !file.includes(".xml")) {
        const arrayBuffer = await fs.readFile(file);
        const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer.buffer);
        const instance = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
          dicomDict.dict
        );

        instance.fileLocation = createImageId(
          file.path,
          urlPrefix,
          studyDirectory
        );
        processInstance(instance, model);
      }
    }

    console.log("Successfully loaded data");

    model.studies.forEach((study) => {
      study.NumInstances = findInstancesNumber(study);
      study.Modalities = findModalities(study).join("/");
    });

    await fs.writeFile(outputPath, JSON.stringify(model, null, 2));
    console.log("JSON saved");
  } catch (error) {
    console.error(error);
  }
}

/**
 * Converts DICOM file buffers to a JSON model.
 *
 * This function processes an array of DICOM file buffers, extracts metadata from each file,
 * and constructs a JSON model representing the study data. It excludes files with extensions
 * ".DS_Store" and ".xml".
 *
 * @param {Array.<{path: string, arrayBuffer: ArrayBuffer}>} files - An array of objects, each containing a DICOM file buffer and its path.
 * @param {string} urlPrefix - The prefix for constructing file URLs in the JSON.
 * @returns {Promise<StudiesData>} - A model containing structured study data.
 */
async function convertDICOMToJSONThroughBuffer(
  files,
  urlPrefix
) {
  /**
   * @type {StudiesData}
   */
  const model = {
    studies: [],
  };

  try {
    for (const file of files) {
      if (!file.path.includes(".DS_Store") && !file.path.includes(".xml")) {
        const dicomDict = dcmjs.data.DicomMessage.readFile(file.arrayBuffer);
        const instance = dcmjs.data.DicomMetaDictionary.naturalizeDataset(
          dicomDict.dict
        );

        instance.fileLocation = createImageId(file.path, urlPrefix);
        processInstance(instance, model);
      }
    }

    console.log("Successfully loaded data");

    model.studies.forEach((study) => {
      study.NumInstances = findInstancesNumber(study);
      study.Modalities = findModalities(study).join("/");
    });

    return model;    
  } catch (error) {
    console.error(error);
  }
}

/**
 * Recursively reads a directory and returns an array of all paths.
 *
 * This function reads the given directory and its subdirectories,
 * and returns an array of paths to all files.
 *
 * @param {string} dir - The path to the directory to read.
 * @returns {Promise<Array<string>>} - A promise resolving to an array of paths.
 */
async function recursiveReadDir(dir) {
  let results = [];
  const list = await fs.readdir(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      const res = await recursiveReadDir(filePath);
      results = results.concat(res);
    } else {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Creates a URL for the DICOM file in the form of "dicomweb:<urlPrefix>/<relativePath>".
 * The relative path is calculated by taking the relative path of the fileLocation to the
 * studyDirectory and normalizing any backslashes to forward slashes.
 * @param {string} fileLocation - The full path of the DICOM file.
 * @param {string} urlPrefix - The prefix to use for the URL.
 * @param {string|undefined} studyDirectory - The directory of the study.
 * @returns {string} The resulting URL.
 */
function createImageId(fileLocation, urlPrefix, studyDirectory) {
  const relativePath = studyDirectory ? path.relative(studyDirectory, fileLocation) : path.basename(fileLocation);
  const normalizedPath = path.normalize(relativePath).replace(/\\/g, "/");
  return `dicomweb:${urlPrefix}${normalizedPath}`;
}

/**
 * Processes a single DICOM instance and adds it to the model.
 *
 * @param {Object} instance - The instance to process.
 * @param {StudiesData} model - The model containing studies.
 */
function processInstance(instance, model) {
  const { StudyInstanceUID, SeriesInstanceUID } = instance;
  let study = getStudy(StudyInstanceUID, model);

  if (!study) {
    study = createStudyMetadata(StudyInstanceUID, instance);
    model.studies.push(study);
  }

  let series = getSeries(StudyInstanceUID, SeriesInstanceUID, model);

  if (!series) {
    series = createSeriesMetadata(instance);
    study.series.push(series);
  }

  const instanceMetaData =
    instance.NumberOfFrames > 1
      ? createInstanceMetaDataMultiFrame(instance)
      : createInstanceMetaData(instance);

  series.instances.push(...[].concat(instanceMetaData));
}

/**
 * Retrieves a study from the model by its unique StudyInstanceUID.
 *
 * @param {string} StudyInstanceUID - The unique identifier for the study instance.
 * @param {StudiesData} model - The model containing an array of studies.
 * @returns {Study|undefined} - The study object with the matching StudyInstanceUID, or undefined if not found.
 */
function getStudy(StudyInstanceUID, model) {
  return model.studies.find(
    (study) => study.StudyInstanceUID === StudyInstanceUID
  );
}

/**
 * Retrieves a series from the model by its unique StudyInstanceUID and SeriesInstanceUID.
 *
 * @param {string} StudyInstanceUID - The unique identifier for the study instance.
 * @param {string} SeriesInstanceUID - The unique identifier for the series instance.
 * @param {StudiesData} model - The model containing an array of studies.
 * @returns {Series|undefined} - The series object with the matching StudyInstanceUID and SeriesInstanceUID, or undefined if not found.
 */
function getSeries(StudyInstanceUID, SeriesInstanceUID, model) {
  const study = getStudy(StudyInstanceUID, model);
  return study
    ? study.series.find(
        (series) => series.SeriesInstanceUID === SeriesInstanceUID
      )
    : undefined;
}

/**
 * Calculates the total number of instances in a study.
 *
 * @param {Study} study - The study object containing an array of series.
 * @returns {number} - The total number of instances in the study.
 */
const findInstancesNumber = (study) => {
  let numInstances = 0;
  study.series.forEach((aSeries) => {
    numInstances = numInstances + aSeries.instances.length;
  });
  return numInstances;
};

const findModalities = (study) => {
  let modalities = new Set();
  study.series.forEach((aSeries) => {
    modalities.add(aSeries.Modality);
  });
  return Array.from(modalities);
};

function createStudyMetadata(StudyInstanceUID, instance) {
  return {
    StudyInstanceUID,
    StudyDescription: instance.StudyDescription,
    StudyDate: instance.StudyDate,
    StudyTime: instance.StudyTime,
    PatientName: instance.PatientName,
    PatientID: instance.PatientID || "1234", // this is critical to have
    AccessionNumber: instance.AccessionNumber,
    PatientAge: instance.PatientAge,
    PatientSex: instance.PatientSex,
    PatientWeight: instance.PatientWeight,
    series: [],
  };
}
function createSeriesMetadata(instance) {
  return {
    SeriesInstanceUID: instance.SeriesInstanceUID,
    SeriesDescription: instance.SeriesDescription,
    SeriesNumber: instance.SeriesNumber,
    SeriesTime: instance.SeriesTime,
    Modality: instance.Modality,
    SliceThickness: instance.SliceThickness,
    instances: [],
  };
}
function commonMetaData(instance) {
  return {
    Columns: instance.Columns,
    Rows: instance.Rows,
    InstanceNumber: instance.InstanceNumber,
    SOPClassUID: instance.SOPClassUID,
    AcquisitionNumber: instance.AcquisitionNumber,
    PhotometricInterpretation: instance.PhotometricInterpretation,
    BitsAllocated: instance.BitsAllocated,
    BitsStored: instance.BitsStored,
    PixelRepresentation: instance.PixelRepresentation,
    SamplesPerPixel: instance.SamplesPerPixel,
    PixelSpacing: instance.PixelSpacing,
    HighBit: instance.HighBit,
    ImageOrientationPatient: instance.ImageOrientationPatient,
    ImagePositionPatient: instance.ImagePositionPatient,
    FrameOfReferenceUID: instance.FrameOfReferenceUID,
    ImageType: instance.ImageType,
    Modality: instance.Modality,
    SOPInstanceUID: instance.SOPInstanceUID,
    SeriesInstanceUID: instance.SeriesInstanceUID,
    StudyInstanceUID: instance.StudyInstanceUID,
    WindowCenter: instance.WindowCenter,
    WindowWidth: instance.WindowWidth,
    RescaleIntercept: instance.RescaleIntercept,
    RescaleSlope: instance.RescaleSlope,
  };
}

function conditionalMetaData(instance) {
  return {
    ...(instance.ConceptNameCodeSequence && {
      ConceptNameCodeSequence: instance.ConceptNameCodeSequence,
    }),
    ...(instance.SeriesDate && { SeriesDate: instance.SeriesDate }),
    ...(instance.ReferencedSeriesSequence && {
      ReferencedSeriesSequence: instance.ReferencedSeriesSequence,
    }),
    ...(instance.SharedFunctionalGroupsSequence && {
      SharedFunctionalGroupsSequence: instance.SharedFunctionalGroupsSequence,
    }),
    ...(instance.PerFrameFunctionalGroupsSequence && {
      PerFrameFunctionalGroupsSequence:
        instance.PerFrameFunctionalGroupsSequence,
    }),
    ...(instance.ContentSequence && {
      ContentSequence: instance.ContentSequence,
    }),
    ...(instance.ContentTemplateSequence && {
      ContentTemplateSequence: instance.ContentTemplateSequence,
    }),
    ...(instance.CurrentRequestedProcedureEvidenceSequence && {
      CurrentRequestedProcedureEvidenceSequence:
        instance.CurrentRequestedProcedureEvidenceSequence,
    }),
    ...(instance.CodingSchemeIdentificationSequence && {
      CodingSchemeIdentificationSequence:
        instance.CodingSchemeIdentificationSequence,
    }),
    ...(instance.RadiopharmaceuticalInformationSequence && {
      RadiopharmaceuticalInformationSequence:
        instance.RadiopharmaceuticalInformationSequence,
    }),
    ...(instance.ROIContourSequence && {
      ROIContourSequence: instance.ROIContourSequence,
    }),
    ...(instance.StructureSetROISequence && {
      StructureSetROISequence: instance.StructureSetROISequence,
    }),
    ...(instance.ReferencedFrameOfReferenceSequence && {
      ReferencedFrameOfReferenceSequence:
        instance.ReferencedFrameOfReferenceSequence,
    }),
    ...(instance.CorrectedImage && { CorrectedImage: instance.CorrectedImage }),
    ...(instance.Units && { Units: instance.Units }),
    ...(instance.DecayCorrection && {
      DecayCorrection: instance.DecayCorrection,
    }),
    ...(instance.AcquisitionDate && {
      AcquisitionDate: instance.AcquisitionDate,
    }),
    ...(instance.AcquisitionTime && {
      AcquisitionTime: instance.AcquisitionTime,
    }),
    ...(instance.PatientWeight && { PatientWeight: instance.PatientWeight }),
    ...(instance.NumberOfFrames && { NumberOfFrames: instance.NumberOfFrames }),
    ...(instance.FrameTime && { FrameTime: instance.FrameTime }),
    ...(instance.EncapsulatedDocument && {
      EncapsulatedDocument: instance.EncapsulatedDocument,
    }),
    ...(instance.SequenceOfUltrasoundRegions && {
      SequenceOfUltrasoundRegions: instance.SequenceOfUltrasoundRegions,
    }),
  };
}

function createInstanceMetaData(instance) {
  const metadata = {
    ...commonMetaData(instance),
    ...conditionalMetaData(instance),
  };
  return { metadata, url: instance.fileLocation };
}

function createInstanceMetaDataMultiFrame(instance) {
  const instances = [];
  const commonData = commonMetaData(instance);
  const conditionalData = conditionalMetaData(instance);

  for (let i = 1; i <= instance.NumberOfFrames; i++) {
    const metadata = { ...commonData, ...conditionalData };
    const result = { metadata, url: instance.fileLocation + `?frame=${i}` };
    instances.push(result);
  }
  return instances;
}

module.exports = {
  convertDICOMToJSONThroughFile,
  convertDICOMToJSONThroughBuffer,
  recursiveReadDir,
};
