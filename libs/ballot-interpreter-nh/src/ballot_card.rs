use std::{cmp::Ordering, fmt::Debug, hash::Hash, io};

use image::GrayImage;
use logging_timer::time;
use serde::{Deserialize, Serialize};

use crate::{
    geometry::{GridUnit, Inch, PixelPosition, PixelUnit, Rect, Size, SubPixelUnit},
    interpret::ResizeStrategy,
};

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize)]
pub enum BallotPaperSize {
    #[serde(rename = "letter")]
    Letter,
    #[serde(rename = "legal")]
    Legal,
}

/// Ballot card orientation.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, Serialize)]
pub enum Orientation {
    /// The ballot card is portrait and right-side up.
    #[serde(rename = "portrait")]
    Portrait,

    /// The ballot card is portrait and upside down.
    #[serde(rename = "portrait-reversed")]
    PortraitReversed,
}

#[derive(Copy, Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Geometry {
    pub ballot_paper_size: BallotPaperSize,
    pub pixels_per_inch: PixelUnit,
    pub canvas_size: Size<PixelUnit>,
    pub content_area: Rect,
    pub timing_mark_size: Size<SubPixelUnit>,
    pub grid_size: Size<GridUnit>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
pub enum BallotSide {
    #[serde(rename = "front")]
    Front,
    #[serde(rename = "back")]
    Back,
}

/// Expected PPI for scanned ballot cards.
const SCAN_PIXELS_PER_INCH: PixelUnit = 200;

/// Expected PPI for ballot card templates.
const TEMPLATE_PIXELS_PER_INCH: PixelUnit = 72;

/// Template margins for the front and back of the ballot card in inches.
const BALLOT_CARD_TEMPLATE_MARGINS: Size<Inch> = Size {
    width: 0.5,
    height: 0.5,
};

/// Scanned margins for the front and back of the ballot card in inches.
const BALLOT_CARD_SCAN_MARGINS: Size<Inch> = Size {
    width: 0.0,
    height: 0.0,
};

#[derive(Debug, Copy, Clone, PartialEq)]
pub struct PaperInfo {
    pub size: BallotPaperSize,
    pub margins: Size<Inch>,
    pub pixels_per_inch: PixelUnit,
}

impl PaperInfo {
    /// Returns info for a letter-sized scanned ballot card.
    pub const fn scanned_letter() -> Self {
        Self {
            size: BallotPaperSize::Letter,
            margins: BALLOT_CARD_SCAN_MARGINS,
            pixels_per_inch: SCAN_PIXELS_PER_INCH,
        }
    }

    /// Returns info for a legal-sized scanned ballot card.
    pub const fn scanned_legal() -> Self {
        Self {
            size: BallotPaperSize::Legal,
            margins: BALLOT_CARD_SCAN_MARGINS,
            pixels_per_inch: SCAN_PIXELS_PER_INCH,
        }
    }

    /// Returns info for a letter-sized ballot card template.
    pub const fn template_letter() -> Self {
        Self {
            size: BallotPaperSize::Letter,
            margins: BALLOT_CARD_TEMPLATE_MARGINS,
            pixels_per_inch: TEMPLATE_PIXELS_PER_INCH,
        }
    }

    /// Returns info for a legal-sized ballot card template.
    pub const fn template_legal() -> Self {
        Self {
            size: BallotPaperSize::Legal,
            margins: BALLOT_CARD_TEMPLATE_MARGINS,
            pixels_per_inch: TEMPLATE_PIXELS_PER_INCH,
        }
    }

    /// Returns info for all supported scanned paper sizes.
    pub const fn scanned() -> [Self; 2] {
        [Self::scanned_letter(), Self::scanned_legal()]
    }

    /// Returns info for all supported template paper sizes.
    pub const fn template() -> [Self; 2] {
        [Self::template_letter(), Self::template_legal()]
    }

    pub fn compute_geometry(&self) -> Geometry {
        let ballot_paper_size = self.size;
        let margins = self.margins;
        let pixels_per_inch = self.pixels_per_inch;
        let (width, height) = match ballot_paper_size {
            BallotPaperSize::Letter => (8.5 as Inch, 11.0 as Inch),
            BallotPaperSize::Legal => (8.5 as Inch, 14.0 as Inch),
        };
        let canvas_size = Size {
            width: (pixels_per_inch as SubPixelUnit * (margins.width.mul_add(2.0, width))).round()
                as PixelUnit,
            height: (pixels_per_inch as SubPixelUnit * (margins.height.mul_add(2.0, height)))
                .round() as PixelUnit,
        };
        let content_area = Rect::new(
            (pixels_per_inch as SubPixelUnit * margins.width).round() as PixelPosition,
            (pixels_per_inch as SubPixelUnit * margins.height).round() as PixelPosition,
            canvas_size.width
                - (pixels_per_inch as SubPixelUnit * margins.width).round() as PixelUnit,
            canvas_size.height
                - (pixels_per_inch as SubPixelUnit * margins.height).round() as PixelUnit,
        );
        let timing_mark_size = Size {
            width: (3.0 / 16.0) * pixels_per_inch as SubPixelUnit,
            height: (1.0 / 16.0) * pixels_per_inch as SubPixelUnit,
        };
        let grid_size = match ballot_paper_size {
            BallotPaperSize::Letter => Size {
                width: 34,
                height: 41,
            },
            BallotPaperSize::Legal => Size {
                width: 34,
                height: 53,
            },
        };

        Geometry {
            ballot_paper_size,
            pixels_per_inch,
            canvas_size,
            content_area,
            timing_mark_size,
            grid_size,
        }
    }
}

pub fn get_matching_paper_info_for_image_size(
    size: (PixelUnit, PixelUnit),
    possible_paper_info: &[PaperInfo],
    resize_strategy: ResizeStrategy,
) -> Option<PaperInfo> {
    const THRESHOLD: f32 = 0.05;
    possible_paper_info
        .iter()
        .map(|paper_info| {
            let geometry = paper_info.compute_geometry();
            (
                paper_info,
                resize_strategy.compute_error(
                    (geometry.canvas_size.width, geometry.canvas_size.height),
                    size,
                ),
            )
        })
        .min_by(|(_, error1), (_, error2)| error1.partial_cmp(error2).unwrap_or(Ordering::Equal))
        .filter(|(_, error)| *error < THRESHOLD)
        .map(|(paper_info, _)| *paper_info)
}

#[time]
pub fn load_ballot_scan_bubble_image() -> Option<GrayImage> {
    let bubble_image_bytes = include_bytes!("../data/bubble_scan.png");
    let inner = io::Cursor::new(bubble_image_bytes);
    image::load(inner, image::ImageFormat::Png)
        .ok()
        .map(|image| image.to_luma8())
}

#[time]
pub fn load_ballot_template_bubble_image() -> Option<GrayImage> {
    let bubble_image_bytes = include_bytes!("../data/bubble_template.png");
    let inner = io::Cursor::new(bubble_image_bytes);
    image::load(inner, image::ImageFormat::Png)
        .ok()
        .map(|image| image.to_luma8())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_scanned_ballot_card_geometry() {
        assert_eq!(
            get_matching_paper_info_for_image_size(
                (1696, 2200),
                &PaperInfo::scanned(),
                ResizeStrategy::Fit
            ),
            Some(PaperInfo::scanned_letter())
        );
        assert_eq!(
            get_matching_paper_info_for_image_size(
                (1696, 2800),
                &PaperInfo::scanned(),
                ResizeStrategy::Fit
            ),
            Some(PaperInfo::scanned_legal())
        );
        assert_eq!(
            get_matching_paper_info_for_image_size(
                (1500, 1500),
                &PaperInfo::scanned(),
                ResizeStrategy::Fit
            ),
            None
        );
    }

    #[test]
    fn test_load_bubble_template() {
        assert!(load_ballot_scan_bubble_image().is_some());
        assert!(load_ballot_template_bubble_image().is_some());
    }

    #[test]
    fn test_ballot_side_deserialize() {
        assert_eq!(
            serde_json::from_str::<BallotSide>(r#""front""#).unwrap(),
            BallotSide::Front
        );
        assert_eq!(
            serde_json::from_str::<BallotSide>(r#""back""#).unwrap(),
            BallotSide::Back
        );
        assert!(serde_json::from_str::<BallotSide>(r#""foo""#).is_err());
    }

    #[test]
    fn test_ballot_side_serialize() {
        assert_eq!(
            serde_json::to_string(&BallotSide::Front).unwrap(),
            r#""front""#
        );
        assert_eq!(
            serde_json::to_string(&BallotSide::Back).unwrap(),
            r#""back""#
        );
    }
}
